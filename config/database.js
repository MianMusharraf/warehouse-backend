// config/database.js - PostgreSQL Database Connection (Improved)
const { Pool } = require('pg');
require('dotenv').config();

// Create connection pool with better error handling
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  // More conservative pool settings for Supabase free tier
  max: 5, // Reduced from 20
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000, // Increased timeout
  // Add these for better Supabase compatibility
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

// Handle pool errors gracefully
pool.on('error', (err, client) => {
  console.error('Database pool error:', err.message);
  // Don't exit process on connection errors
  if (err.message.includes('termination')) {
    console.log('⚠️  Database connection terminated. Will retry on next query.');
  }
});

// Test connection on startup
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Initial database connection failed:', err.message);
    console.log('ℹ️  Server will continue, database will reconnect on first query');
  } else {
    console.log('✅ Database connected successfully');
  }
});

module.exports = pool;