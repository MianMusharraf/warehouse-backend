// server.js - Main Express Server
// This is the entry point of your backend application

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const palletRoutes = require('./routes/pallets');
const qrRoutes = require('./routes/qr');
const floRoutes = require('./routes/flo');
const analyticsRoutes = require('./routes/analytics');

// Import database connection
const pool = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// ============= MIDDLEWARE =============
// Parse JSON bodies
app.use(express.json());

// Enable CORS for frontend access
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

// Security headers
app.use(helmet());

// Logging middleware (shows API requests in console)
app.use(morgan('dev'));

// ============= ROUTES =============
// Health check endpoint (to verify server is running)
app.get('/', (req, res) => {
  res.json({ 
    message: 'Warehouse Management System API',
    status: 'running',
    version: '1.0.0'
  });
});

// API Routes
app.use('/api/auth', authRoutes);           // Login/Register
app.use('/api/pallets', palletRoutes);       // Pallet operations
app.use('/api/qr', qrRoutes);               // QR code generation
app.use('/api/flo', floRoutes);             // FLO operator data
app.use('/api/analytics', analyticsRoutes);  // Reports & analytics

// ============= ERROR HANDLING =============
// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// ============= START SERVER =============
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}`);
  
  // Test database connection
  pool.query('SELECT NOW()', (err, res) => {
    if (err) {
      console.error('❌ Database connection failed:', err.message);
    } else {
      console.log('✅ Database connected successfully');
    }
  });
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  pool.end(() => {
    console.log('Database pool closed');
    process.exit(0);
  });
});