// routes/auth.js - Authentication Routes (Login/Register)

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// ============= LOGIN =============
// POST /api/auth/login
// Body: { username, password }
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Find user
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Check if account is active
    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is inactive' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id,
        username: user.username,
        role: user.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' } // Token valid for 7 days
    );

    // Return token and user info (without password)
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        floId: user.flo_id
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ============= REGISTER FLO OPERATOR =============
// POST /api/auth/register/flo
// Body: { username, password, fullName, floId }
// Note: This should be protected in production (only admin can create FLO accounts)
router.post('/register/flo', async (req, res) => {
  try {
    const { username, password, fullName, floId } = req.body;

    // Validate input
    if (!username || !password || !fullName || !floId) {
      return res.status(400).json({ 
        error: 'Username, password, full name, and FLO ID required' 
      });
    }

    // Password strength check
    if (password.length < 6) {
      return res.status(400).json({ 
        error: 'Password must be at least 6 characters' 
      });
    }

    // Check if username or floId already exists
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE username = $1 OR flo_id = $2',
      [username, floId]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ 
        error: 'Username or FLO ID already exists' 
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert new FLO operator
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, full_name, role, flo_id) 
       VALUES ($1, $2, $3, 'flo', $4) 
       RETURNING id, username, full_name, role, flo_id`,
      [username, passwordHash, fullName, floId]
    );

    const newUser = result.rows[0];

    res.status(201).json({
      message: 'FLO operator registered successfully',
      user: {
        id: newUser.id,
        username: newUser.username,
        fullName: newUser.full_name,
        role: newUser.role,
        floId: newUser.flo_id
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ============= REGISTER ADMIN =============
// POST /api/auth/register/admin
// Body: { username, password, fullName }
router.post('/register/admin', async (req, res) => {
  try {
    const { username, password, fullName } = req.body;

    // Validate input
    if (!username || !password || !fullName) {
      return res.status(400).json({ 
        error: 'Username, password, and full name required' 
      });
    }

    // Password strength check
    if (password.length < 8) {
      return res.status(400).json({ 
        error: 'Admin password must be at least 8 characters' 
      });
    }

    // Check if username exists
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert new admin
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, full_name, role) 
       VALUES ($1, $2, $3, 'admin') 
       RETURNING id, username, full_name, role`,
      [username, passwordHash, fullName]
    );

    const newUser = result.rows[0];

    res.status(201).json({
      message: 'Admin registered successfully',
      user: {
        id: newUser.id,
        username: newUser.username,
        fullName: newUser.full_name,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error('Admin registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ============= VERIFY TOKEN =============
// GET /api/auth/verify
// Returns current user info if token is valid
router.get('/verify', verifyToken, async (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      username: req.user.username,
      fullName: req.user.full_name,
      role: req.user.role,
      floId: req.user.flo_id
    }
  });
});

// ============= CHANGE PASSWORD =============
// POST /api/auth/change-password
// Body: { oldPassword, newPassword }
router.post('/change-password', verifyToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ 
        error: 'Old password and new password required' 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        error: 'New password must be at least 6 characters' 
      });
    }

    // Get current user with password
    const result = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    const user = result.rows[0];

    // Verify old password
    const validPassword = await bcrypt.compare(oldPassword, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newPasswordHash, req.user.id]
    );

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router;