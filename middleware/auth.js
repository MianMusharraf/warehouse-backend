// middleware/auth.js - JWT Authentication Middleware
// Protects routes and verifies user tokens

const jwt = require('jsonwebtoken');
const pool = require('../config/database');

// Verify JWT token from request header
const verifyToken = async (req, res, next) => {
  try {
    // Get token from Authorization header
    // Expected format: "Bearer <token>"
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const result = await pool.query(
      'SELECT id, username, full_name, role, flo_id, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(401).json({ error: 'User account is inactive' });
    }

    // Attach user to request object for use in routes
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Check if user is admin
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Check if user is FLO operator
const isFLO = (req, res, next) => {
  if (req.user.role !== 'flo') {
    return res.status(403).json({ error: 'FLO access required' });
  }
  next();
};

// Allow both admin and FLO
const isAuthenticated = verifyToken;

module.exports = {
  verifyToken,
  isAdmin,
  isFLO,
  isAuthenticated
};