// routes/flo.js - FLO Operator Routes

const express = require('express');
const pool = require('../config/database');
const { verifyToken, isFLO } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// ============= GET MY STATS (FLO Dashboard) =============
// GET /api/flo/my-stats
// Returns current FLO's performance stats
router.get('/my-stats', isFLO, async (req, res) => {
  try {
    const floId = req.user.flo_id;

    // Today's stats
    const todayResult = await pool.query(
      `SELECT 
        COUNT(DISTINCT pallet_id) as pallets_handled_today,
        COUNT(*) as total_scans_today
       FROM pallet_scans 
       WHERE flo_id = $1 AND DATE(scanned_at) = CURRENT_DATE`,
      [floId]
    );

    // This week's stats
    const weekResult = await pool.query(
      `SELECT 
        COUNT(DISTINCT pallet_id) as pallets_handled_week,
        COUNT(*) as total_scans_week
       FROM pallet_scans 
       WHERE flo_id = $1 
       AND scanned_at >= DATE_TRUNC('week', CURRENT_DATE)`,
      [floId]
    );

    // This month's stats
    const monthResult = await pool.query(
      `SELECT 
        COUNT(DISTINCT pallet_id) as pallets_handled_month,
        COUNT(*) as total_scans_month
       FROM pallet_scans 
       WHERE flo_id = $1 
       AND scanned_at >= DATE_TRUNC('month', CURRENT_DATE)`,
      [floId]
    );

    // Recent activity
    const recentActivity = await pool.query(
      `SELECT 
        pallet_id,
        previous_status,
        new_status,
        scanned_at,
        scan_location
       FROM pallet_scans 
       WHERE flo_id = $1 
       ORDER BY scanned_at DESC 
       LIMIT 10`,
      [floId]
    );

    res.json({
      floId,
      floName: req.user.full_name,
      today: todayResult.rows[0],
      thisWeek: weekResult.rows[0],
      thisMonth: monthResult.rows[0],
      recentActivity: recentActivity.rows
    });
  } catch (error) {
    console.error('Get FLO stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ============= CLOCK IN/OUT FOR SHIFT =============
// POST /api/flo/shift/clock-in
// Body: { shiftType: "morning" | "afternoon" | "night" }
router.post('/shift/clock-in', isFLO, async (req, res) => {
  try {
    const { shiftType } = req.body;
    const floId = req.user.flo_id;
    const today = new Date().toISOString().split('T')[0];

    if (!['morning', 'afternoon', 'night'].includes(shiftType)) {
      return res.status(400).json({ 
        error: 'Invalid shift type. Must be: morning, afternoon, or night' 
      });
    }

    // Check if already clocked in for this shift
    const existing = await pool.query(
      `SELECT * FROM shifts 
       WHERE flo_id = $1 AND shift_date = $2 AND shift_type = $3`,
      [floId, today, shiftType]
    );

    if (existing.rows.length > 0 && existing.rows[0].clock_in) {
      return res.status(400).json({ 
        error: 'Already clocked in for this shift',
        shift: existing.rows[0]
      });
    }

    // Insert or update shift record
    const result = await pool.query(
      `INSERT INTO shifts (flo_id, shift_date, shift_type, clock_in) 
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (flo_id, shift_date, shift_type) 
       DO UPDATE SET clock_in = CURRENT_TIMESTAMP
       RETURNING *`,
      [floId, today, shiftType]
    );

    res.json({
      message: 'Clocked in successfully',
      shift: result.rows[0]
    });
  } catch (error) {
    console.error('Clock in error:', error);
    res.status(500).json({ error: 'Failed to clock in' });
  }
});

// POST /api/flo/shift/clock-out
router.post('/shift/clock-out', isFLO, async (req, res) => {
  try {
    const floId = req.user.flo_id;
    const today = new Date().toISOString().split('T')[0];

    // Find active shift (clocked in but not clocked out)
    const result = await pool.query(
      `SELECT * FROM shifts 
       WHERE flo_id = $1 
       AND shift_date = $2 
       AND clock_in IS NOT NULL 
       AND clock_out IS NULL
       ORDER BY clock_in DESC
       LIMIT 1`,
      [floId, today]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'No active shift found' });
    }

    const shift = result.rows[0];

    // Count pallets handled during this shift
    const palletCount = await pool.query(
      `SELECT COUNT(DISTINCT pallet_id) as count
       FROM pallet_scans 
       WHERE flo_id = $1 
       AND scanned_at >= $2 
       AND scanned_at <= CURRENT_TIMESTAMP`,
      [floId, shift.clock_in]
    );

    // Update shift with clock out time and pallet count
    const updated = await pool.query(
      `UPDATE shifts 
       SET clock_out = CURRENT_TIMESTAMP, 
           pallets_handled = $1
       WHERE id = $2
       RETURNING *`,
      [palletCount.rows[0].count, shift.id]
    );

    res.json({
      message: 'Clocked out successfully',
      shift: updated.rows[0]
    });
  } catch (error) {
    console.error('Clock out error:', error);
    res.status(500).json({ error: 'Failed to clock out' });
  }
});

// ============= GET MY SHIFT HISTORY =============
// GET /api/flo/shifts?limit=30
router.get('/shifts', isFLO, async (req, res) => {
  try {
    const floId = req.user.flo_id;
    const { limit = 30 } = req.query;

    const result = await pool.query(
      `SELECT * FROM shifts 
       WHERE flo_id = $1 
       ORDER BY shift_date DESC, clock_in DESC 
       LIMIT $2`,
      [floId, limit]
    );

    res.json({
      shifts: result.rows
    });
  } catch (error) {
    console.error('Get shifts error:', error);
    res.status(500).json({ error: 'Failed to fetch shifts' });
  }
});

// ============= GET ALL FLO OPERATORS (Admin only) =============
// GET /api/flo/all
router.get('/all', async (req, res) => {
  try {
    // Only admin can see all FLOs
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await pool.query(
      `SELECT id, username, full_name, flo_id, is_active, created_at
       FROM users 
       WHERE role = 'flo' 
       ORDER BY full_name`
    );

    res.json({
      flos: result.rows
    });
  } catch (error) {
    console.error('Get all FLOs error:', error);
    res.status(500).json({ error: 'Failed to fetch FLO operators' });
  }
});

module.exports = router;