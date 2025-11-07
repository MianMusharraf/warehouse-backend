// routes/analytics.js - Analytics & Reports Routes

const express = require('express');
const pool = require('../config/database');
const { verifyToken, isAdmin } = require('../middleware/auth');

const router = express.Router();

// All routes require admin authentication
router.use(verifyToken, isAdmin);

// ============= DASHBOARD OVERVIEW =============
// GET /api/analytics/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    // Total pallets by status
    const statusCount = await pool.query(
      `SELECT status, COUNT(*) as count 
       FROM pallets 
       GROUP BY status 
       ORDER BY count DESC`
    );

    // Today's activity
    const todayActivity = await pool.query(
      `SELECT COUNT(*) as scans_today 
       FROM pallet_scans 
       WHERE DATE(scanned_at) = CURRENT_DATE`
    );

    // Active FLOs today
    const activeFLOs = await pool.query(
      `SELECT COUNT(DISTINCT flo_id) as active_flos 
       FROM pallet_scans 
       WHERE DATE(scanned_at) = CURRENT_DATE`
    );

    // Warehouse stock count
    const warehouseStock = await pool.query(
      `SELECT COUNT(*) as count 
       FROM pallets 
       WHERE status = 'At Warehouse'`
    );

    // Pallets out for delivery
    const outForDelivery = await pool.query(
      `SELECT COUNT(*) as count 
       FROM pallets 
       WHERE status = 'Out for Delivery'`
    );

    // Recent scans
    const recentScans = await pool.query(
      `SELECT 
        ps.pallet_id,
        ps.flo_name,
        ps.previous_status,
        ps.new_status,
        ps.scanned_at,
        p.item_name
       FROM pallet_scans ps
       LEFT JOIN pallets p ON ps.pallet_id = p.pallet_id
       ORDER BY ps.scanned_at DESC 
       LIMIT 10`
    );

    res.json({
      summary: {
        totalPallets: statusCount.rows.reduce((sum, row) => sum + parseInt(row.count), 0),
        atWarehouse: warehouseStock.rows[0].count,
        outForDelivery: outForDelivery.rows[0].count,
        todayScans: todayActivity.rows[0].scans_today,
        activeFLOsToday: activeFLOs.rows[0].active_flos
      },
      palletsByStatus: statusCount.rows,
      recentActivity: recentScans.rows
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// ============= FLO PERFORMANCE REPORT =============
// GET /api/analytics/flo-performance?startDate=2024-01-01&endDate=2024-12-31
router.get('/flo-performance', async (req, res) => {
  try {
    const { startDate, endDate, floId } = req.query;

    let query = `
      SELECT 
        flo_id,
        flo_name,
        DATE(scanned_at) as date,
        COUNT(DISTINCT pallet_id) as pallets_handled,
        COUNT(*) as total_scans
      FROM pallet_scans
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (startDate) {
      query += ` AND DATE(scanned_at) >= $${paramCount}`;
      params.push(startDate);
      paramCount++;
    }

    if (endDate) {
      query += ` AND DATE(scanned_at) <= $${paramCount}`;
      params.push(endDate);
      paramCount++;
    }

    if (floId) {
      query += ` AND flo_id = $${paramCount}`;
      params.push(floId);
      paramCount++;
    }

    query += ` GROUP BY flo_id, flo_name, DATE(scanned_at) ORDER BY date DESC, pallets_handled DESC`;

    const result = await pool.query(query, params);

    // Calculate summary stats per FLO
    const floSummary = {};
    result.rows.forEach(row => {
      if (!floSummary[row.flo_id]) {
        floSummary[row.flo_id] = {
          floId: row.flo_id,
          floName: row.flo_name,
          totalPalletsHandled: 0,
          totalScans: 0,
          daysWorked: 0
        };
      }
      floSummary[row.flo_id].totalPalletsHandled += parseInt(row.pallets_handled);
      floSummary[row.flo_id].totalScans += parseInt(row.total_scans);
      floSummary[row.flo_id].daysWorked += 1;
    });

    res.json({
      dailyPerformance: result.rows,
      summary: Object.values(floSummary)
    });
  } catch (error) {
    console.error('FLO performance error:', error);
    res.status(500).json({ error: 'Failed to fetch FLO performance' });
  }
});

// ============= PALLET MOVEMENT REPORT =============
// GET /api/analytics/pallet-movements?days=7
router.get('/pallet-movements', async (req, res) => {
  try {
    const { days = 7 } = req.query;

    // Daily pallet movements
    const movements = await pool.query(
      `SELECT 
        DATE(scanned_at) as date,
        new_status,
        COUNT(*) as count
       FROM pallet_scans
       WHERE scanned_at >= CURRENT_DATE - INTERVAL '${days} days'
       GROUP BY DATE(scanned_at), new_status
       ORDER BY date DESC, count DESC`
    );

    // Average time in each status
    const avgTimeInStatus = await pool.query(
      `SELECT 
        new_status as status,
        AVG(
          EXTRACT(EPOCH FROM (
            LEAD(scanned_at) OVER (PARTITION BY pallet_id ORDER BY scanned_at) - scanned_at
          )) / 3600
        ) as avg_hours
       FROM pallet_scans
       GROUP BY new_status
       HAVING AVG(
         EXTRACT(EPOCH FROM (
           LEAD(scanned_at) OVER (PARTITION BY pallet_id ORDER BY scanned_at) - scanned_at
         ))
       ) IS NOT NULL`
    );

    res.json({
      dailyMovements: movements.rows,
      averageTimeInStatus: avgTimeInStatus.rows
    });
  } catch (error) {
    console.error('Pallet movements error:', error);
    res.status(500).json({ error: 'Failed to fetch pallet movements' });
  }
});

// ============= WAREHOUSE LOCATION REPORT =============
// GET /api/analytics/warehouse-locations
router.get('/warehouse-locations', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        warehouse_location,
        COUNT(*) as pallet_count,
        SUM(item_quantity) as total_items,
        SUM(weight_kg) as total_weight_kg
       FROM pallets
       WHERE status = 'At Warehouse' AND warehouse_location IS NOT NULL
       GROUP BY warehouse_location
       ORDER BY pallet_count DESC`
    );

    res.json({
      locations: result.rows,
      totalLocations: result.rows.length
    });
  } catch (error) {
    console.error('Warehouse locations error:', error);
    res.status(500).json({ error: 'Failed to fetch warehouse locations' });
  }
});

// ============= ITEM STOCK REPORT =============
// GET /api/analytics/item-stock
router.get('/item-stock', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        item_code,
        item_name,
        COUNT(*) as total_pallets,
        SUM(item_quantity) as total_quantity,
        SUM(CASE WHEN status = 'At Warehouse' THEN 1 ELSE 0 END) as pallets_at_warehouse,
        SUM(CASE WHEN status = 'At Warehouse' THEN item_quantity ELSE 0 END) as quantity_at_warehouse
       FROM pallets
       GROUP BY item_code, item_name
       ORDER BY total_pallets DESC`
    );

    res.json({
      items: result.rows
    });
  } catch (error) {
    console.error('Item stock error:', error);
    res.status(500).json({ error: 'Failed to fetch item stock' });
  }
});

// ============= EXPIRING ITEMS REPORT =============
// GET /api/analytics/expiring-items?days=30
router.get('/expiring-items', async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const result = await pool.query(
      `SELECT 
        pallet_id,
        item_code,
        item_name,
        expiry_date,
        status,
        warehouse_location,
        DATE_PART('day', expiry_date - CURRENT_DATE) as days_until_expiry
       FROM pallets
       WHERE expiry_date IS NOT NULL
       AND expiry_date <= CURRENT_DATE + INTERVAL '${days} days'
       AND status IN ('At Production', 'At Warehouse', 'In Transit to Warehouse')
       ORDER BY expiry_date ASC`
    );

    res.json({
      expiringItems: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Expiring items error:', error);
    res.status(500).json({ error: 'Failed to fetch expiring items' });
  }
});

// ============= DAILY ACTIVITY TIMELINE =============
// GET /api/analytics/daily-timeline?date=2024-11-01
router.get('/daily-timeline', async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const result = await pool.query(
      `SELECT 
        ps.id,
        ps.pallet_id,
        ps.flo_id,
        ps.flo_name,
        ps.previous_status,
        ps.new_status,
        ps.scanned_at,
        ps.scan_location,
        p.item_name,
        p.item_code
       FROM pallet_scans ps
       LEFT JOIN pallets p ON ps.pallet_id = p.pallet_id
       WHERE DATE(ps.scanned_at) = $1
       ORDER BY ps.scanned_at DESC`,
      [targetDate]
    );

    // Group by hour for visualization
    const byHour = {};
    result.rows.forEach(scan => {
      const hour = new Date(scan.scanned_at).getHours();
      if (!byHour[hour]) {
        byHour[hour] = [];
      }
      byHour[hour].push(scan);
    });

    res.json({
      date: targetDate,
      totalScans: result.rows.length,
      timeline: result.rows,
      byHour
    });
  } catch (error) {
    console.error('Daily timeline error:', error);
    res.status(500).json({ error: 'Failed to fetch daily timeline' });
  }
});

module.exports = router;