// server.js - Main Express Server
// Entry point of the backend application

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

// ============= CORS CONFIG =============

// Allowed origins for frontend
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  process.env.FRONTEND_URL, // e.g. https://your-frontend-domain.com
].filter(Boolean); // remove undefined / empty values

console.log('✅ Allowed CORS origins:', allowedOrigins);

app.use((req, res, next) => {
  const origin = req.headers.origin;

  // For debugging in Railway logs
  if (origin) {
    console.log('🌐 Incoming Origin:', origin);
  }

  // Allow requests with no origin (like Postman, curl)
  if (!origin || allowedOrigins.includes(origin)) {
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin);
    } else {
      // For non-browser tools
      res.header('Access-Control-Allow-Origin', '*');
    }

    res.header('Access-Control-Allow-Credentials', 'true');
    res.header(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization'
    );
    res.header(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS'
    );

    // Handle preflight
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }

    return next();
  }

  console.log('❌ Blocked by CORS:', origin);
  return res.status(403).json({ error: 'Not allowed by CORS' });
});

// If you still want to use the cors package somewhere else, you can,
// but the above middleware already covers it for normal use.
// app.use(cors());

// ============= MIDDLEWARE =============

// Parse JSON bodies
app.use(express.json());

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
    version: '1.0.0',
  });
});

// API Routes
app.use('/api/auth', authRoutes);            // Login/Register
app.use('/api/pallets', palletRoutes);       // Pallet operations
app.use('/api/qr', qrRoutes);                // QR code generation
app.use('/api/flo', floRoutes);              // FLO operator data
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
    error: err.message || 'Internal server error',
  });
});

// ============= START SERVER =============

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}`);

  // Test database connection
  pool.query('SELECT NOW()', (err, result) => {
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
