// routes/pallets.js - Pallet Management Routes

const express = require('express');
const pool = require('../config/database');
const { verifyToken, isAdmin } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// ============= CREATE PALLET =============
// POST /api/pallets
// Body: { palletId, itemCode, itemName, itemQuantity, unitNo, weightKg, productionDate, expiryDate, warehouseLocation, destination }
router.post('/', isAdmin, async (req, res) => {
  try {
    const {
      palletId,
      itemCode,
      itemName,
      itemQuantity,
      unitNo,
      weightKg,
      productionDate,
      expiryDate,
      warehouseLocation,
      destination
    } = req.body;

    // Validate required fields
    if (!palletId || !itemCode || !itemName || !itemQuantity) {
      return res.status(400).json({ 
        error: 'Pallet ID, item code, item name, and quantity are required' 
      });
    }

    // Check if pallet ID already exists
    const existing = await pool.query(
      'SELECT pallet_id FROM pallets WHERE pallet_id = $1',
      [palletId]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Pallet ID already exists' });
    }

    // Insert pallet
    const result = await pool.query(
      `INSERT INTO pallets (
        pallet_id, item_code, item_name, item_quantity, unit_no, 
        weight_kg, production_date, expiry_date, warehouse_location, destination
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
      RETURNING *`,
      [palletId, itemCode, itemName, itemQuantity, unitNo, weightKg, 
       productionDate, expiryDate, warehouseLocation, destination]
    );

    res.status(201).json({
      message: 'Pallet created successfully',
      pallet: result.rows[0]
    });
  } catch (error) {
    console.error('Create pallet error:', error);
    res.status(500).json({ error: 'Failed to create pallet' });
  }
});

// ============= GET PALLET BY ID =============
// GET /api/pallets/:palletId
router.get('/:palletId', async (req, res) => {
  try {
    const { palletId } = req.params;

    const result = await pool.query(
      'SELECT * FROM pallets WHERE pallet_id = $1',
      [palletId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pallet not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get pallet error:', error);
    res.status(500).json({ error: 'Failed to fetch pallet' });
  }
});

// ============= GET ALL PALLETS =============
// GET /api/pallets?status=At Warehouse&limit=50
router.get('/', async (req, res) => {
  try {
    const { status, itemCode, warehouseLocation, limit = 100, offset = 0 } = req.query;

    let query = 'SELECT * FROM pallets WHERE 1=1';
    const params = [];
    let paramCount = 1;

    // Filter by status
    if (status) {
      query += ` AND status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    // Filter by item code
    if (itemCode) {
      query += ` AND item_code = $${paramCount}`;
      params.push(itemCode);
      paramCount++;
    }

    // Filter by warehouse location
    if (warehouseLocation) {
      query += ` AND warehouse_location = $${paramCount}`;
      params.push(warehouseLocation);
      paramCount++;
    }

    // Order by most recent first
    query += ' ORDER BY created_at DESC';

    // Pagination
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) FROM pallets WHERE 1=1';
    const countParams = [];
    let countParamNum = 1;

    if (status) {
      countQuery += ` AND status = $${countParamNum}`;
      countParams.push(status);
      countParamNum++;
    }
    if (itemCode) {
      countQuery += ` AND item_code = $${countParamNum}`;
      countParams.push(itemCode);
      countParamNum++;
    }
    if (warehouseLocation) {
      countQuery += ` AND warehouse_location = $${countParamNum}`;
      countParams.push(warehouseLocation);
    }

    const countResult = await pool.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      pallets: result.rows,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: totalCount > (parseInt(offset) + result.rows.length)
      }
    });
  } catch (error) {
    console.error('Get pallets error:', error);
    res.status(500).json({ error: 'Failed to fetch pallets' });
  }
});

// ============= SCAN PALLET (UPDATE STATUS) =============
// POST /api/pallets/:palletId/scan
// Body: { newStatus, warehouseLocation?, notes? }
router.post('/:palletId/scan', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { palletId } = req.params;
    const { newStatus, warehouseLocation, notes, latitude, longitude } = req.body;

    // Validate new status
    const validStatuses = [
      'At Production',
      'Picked from Production',
      'In Transit to Warehouse',
      'At Warehouse',
      'Picked for Delivery',
      'Out for Delivery',
      'Delivered'
    ];

    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await client.query('BEGIN');

    // Get current pallet info
    const palletResult = await client.query(
      'SELECT * FROM pallets WHERE pallet_id = $1 FOR UPDATE',
      [palletId]
    );

    if (palletResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pallet not found' });
    }

    const pallet = palletResult.rows[0];
    const previousStatus = pallet.status;

    // Update pallet status
    let updateQuery = 'UPDATE pallets SET status = $1, updated_at = CURRENT_TIMESTAMP';
    const updateParams = [newStatus];
    let paramCount = 2;

    // Update warehouse location if provided
    if (warehouseLocation) {
      updateQuery += `, warehouse_location = $${paramCount}`;
      updateParams.push(warehouseLocation);
      paramCount++;
    }

    updateQuery += ` WHERE pallet_id = $${paramCount} RETURNING *`;
    updateParams.push(palletId);

    const updatedPallet = await client.query(updateQuery, updateParams);

    // Record scan in audit trail
    await client.query(
      `INSERT INTO pallet_scans (
        pallet_id, flo_id, flo_name, previous_status, new_status, 
        scan_location, latitude, longitude, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        palletId,
        req.user.flo_id || req.user.username,
        req.user.full_name,
        previousStatus,
        newStatus,
        warehouseLocation,
        latitude,
        longitude,
        notes
      ]
    );

    await client.query('COMMIT');

    res.json({
      message: 'Pallet scanned successfully',
      pallet: updatedPallet.rows[0],
      previousStatus,
      newStatus
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Scan pallet error:', error);
    res.status(500).json({ error: 'Failed to scan pallet' });
  } finally {
    client.release();
  }
});

// ============= GET PALLET HISTORY =============
// GET /api/pallets/:palletId/history
router.get('/:palletId/history', async (req, res) => {
  try {
    const { palletId } = req.params;

    const result = await pool.query(
      `SELECT * FROM pallet_scans 
       WHERE pallet_id = $1 
       ORDER BY scanned_at DESC`,
      [palletId]
    );

    res.json({
      palletId,
      history: result.rows
    });
  } catch (error) {
    console.error('Get pallet history error:', error);
    res.status(500).json({ error: 'Failed to fetch pallet history' });
  }
});

// ============= UPDATE PALLET INFO =============
// PUT /api/pallets/:palletId
// Body: Any pallet fields to update
router.put('/:palletId', isAdmin, async (req, res) => {
  try {
    const { palletId } = req.params;
    const {
      itemCode,
      itemName,
      itemQuantity,
      unitNo,
      weightKg,
      productionDate,
      expiryDate,
      warehouseLocation,
      destination
    } = req.body;

    // Build dynamic update query
    const updates = [];
    const params = [];
    let paramCount = 1;

    if (itemCode !== undefined) {
      updates.push(`item_code = $${paramCount}`);
      params.push(itemCode);
      paramCount++;
    }
    if (itemName !== undefined) {
      updates.push(`item_name = $${paramCount}`);
      params.push(itemName);
      paramCount++;
    }
    if (itemQuantity !== undefined) {
      updates.push(`item_quantity = $${paramCount}`);
      params.push(itemQuantity);
      paramCount++;
    }
    if (unitNo !== undefined) {
      updates.push(`unit_no = $${paramCount}`);
      params.push(unitNo);
      paramCount++;
    }
    if (weightKg !== undefined) {
      updates.push(`weight_kg = $${paramCount}`);
      params.push(weightKg);
      paramCount++;
    }
    if (productionDate !== undefined) {
      updates.push(`production_date = $${paramCount}`);
      params.push(productionDate);
      paramCount++;
    }
    if (expiryDate !== undefined) {
      updates.push(`expiry_date = $${paramCount}`);
      params.push(expiryDate);
      paramCount++;
    }
    if (warehouseLocation !== undefined) {
      updates.push(`warehouse_location = $${paramCount}`);
      params.push(warehouseLocation);
      paramCount++;
    }
    if (destination !== undefined) {
      updates.push(`destination = $${paramCount}`);
      params.push(destination);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(palletId);

    const query = `UPDATE pallets SET ${updates.join(', ')} WHERE pallet_id = $${paramCount} RETURNING *`;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pallet not found' });
    }

    res.json({
      message: 'Pallet updated successfully',
      pallet: result.rows[0]
    });
  } catch (error) {
    console.error('Update pallet error:', error);
    res.status(500).json({ error: 'Failed to update pallet' });
  }
});

// ============= DELETE PALLET =============
// DELETE /api/pallets/:palletId
router.delete('/:palletId', isAdmin, async (req, res) => {
  try {
    const { palletId } = req.params;

    const result = await pool.query(
      'DELETE FROM pallets WHERE pallet_id = $1 RETURNING pallet_id',
      [palletId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pallet not found' });
    }

    res.json({ message: 'Pallet deleted successfully' });
  } catch (error) {
    console.error('Delete pallet error:', error);
    res.status(500).json({ error: 'Failed to delete pallet' });
  }
});

// ============= GET WAREHOUSE STOCK =============
// GET /api/pallets/warehouse/stock
// Returns all pallets currently at warehouse
router.get('/warehouse/stock', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM current_warehouse_stock ORDER BY last_scan_time DESC'
    );

    // Group by warehouse location
    const stockByLocation = {};
    result.rows.forEach(pallet => {
      const location = pallet.warehouse_location || 'Unassigned';
      if (!stockByLocation[location]) {
        stockByLocation[location] = [];
      }
      stockByLocation[location].push(pallet);
    });

    res.json({
      totalPallets: result.rows.length,
      pallets: result.rows,
      byLocation: stockByLocation
    });
  } catch (error) {
    console.error('Get warehouse stock error:', error);
    res.status(500).json({ error: 'Failed to fetch warehouse stock' });
  }
});

module.exports = router;