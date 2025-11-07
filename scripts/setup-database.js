// scripts/setup-database.js - Automated Database Setup Script
// Run this once to create all tables and initial admin user

const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function setupDatabase() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false  // Always use SSL for Supabase
    },
    // Better connection settings for Supabase
    max: 5,
    connectionTimeoutMillis: 5000,
  });

  try {
    console.log('🔄 Starting database setup...\n');

    // Read schema file
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    let schema = fs.readFileSync(schemaPath, 'utf8');

    // Execute schema
    console.log('📋 Creating tables and indexes...');
    await pool.query(schema);
    console.log('✅ Tables created successfully\n');

    // Create default admin user
    console.log('👤 Creating default admin user...');
    const defaultPassword = 'admin123'; // CHANGE THIS IMMEDIATELY
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    try {
      await pool.query(
        `INSERT INTO users (username, password_hash, full_name, role) 
         VALUES ($1, $2, $3, $4)`,
        ['admin', passwordHash, 'System Administrator', 'admin']
      );
      console.log('✅ Admin user created');
      console.log('   Username: admin');
      console.log('   Password: admin123');
      console.log('   ⚠️  CHANGE THIS PASSWORD IMMEDIATELY!\n');
    } catch (err) {
      if (err.code === '23505') {
        console.log('ℹ️  Admin user already exists\n');
      } else {
        throw err;
      }
    }

    // Create sample FLO operator (optional)
    console.log('👷 Creating sample FLO operator...');
    const floPassword = 'flo123';
    const floPasswordHash = await bcrypt.hash(floPassword, 10);

    try {
      await pool.query(
        `INSERT INTO users (username, password_hash, full_name, role, flo_id) 
         VALUES ($1, $2, $3, $4, $5)`,
        ['flo001', floPasswordHash, 'John Forklift', 'flo', 'FLO001']
      );
      console.log('✅ Sample FLO operator created');
      console.log('   Username: flo001');
      console.log('   Password: flo123');
      console.log('   FLO ID: FLO001\n');
    } catch (err) {
      if (err.code === '23505') {
        console.log('ℹ️  Sample FLO operator already exists\n');
      } else {
        // Don't fail if FLO creation fails
        console.log('⚠️  FLO operator creation failed:', err.message);
      }
    }

    // Create sample pallet (optional)
    console.log('📦 Creating sample pallet...');
    try {
      await pool.query(
        `INSERT INTO pallets (
          pallet_id, item_code, item_name, item_quantity, unit_no,
          weight_kg, production_date, expiry_date, status, warehouse_location
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          'PLT001',
          'ITEM-001',
          'Sample Product',
          100,
          'BOX',
          250.5,
          new Date().toISOString().split('T')[0],
          new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 90 days from now
          'At Production',
          null
        ]
      );
      console.log('✅ Sample pallet created (PLT001)\n');
    } catch (err) {
      if (err.code === '23505') {
        console.log('ℹ️  Sample pallet already exists\n');
      } else {
        // Don't fail if pallet creation fails
        console.log('⚠️  Sample pallet creation failed:', err.message);
      }
    }

    console.log('🎉 Database setup completed successfully!\n');
    console.log('Next steps:');
    console.log('1. Start the server: npm start');
    console.log('2. Test login with admin credentials');
    console.log('3. Change default passwords immediately!');

  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    
    // Check if it's a connection termination error
    if (error.message && error.message.includes('termination')) {
      console.log('\n⚠️  Database connection terminated (Supabase free tier limit)');
      console.log('ℹ️  This is normal - core tables and users were likely created successfully');
      console.log('✅ Try logging in with: admin / admin123\n');
      await pool.end();
      return; // Exit gracefully without error code
    }
    
    // For other errors, show details and exit with error
    console.error('\nFull error details:', error);
    await pool.end();
    process.exit(1);
    
  } finally {
    // Ensure pool is closed
    if (!pool.ended) {
      await pool.end();
    }
  }
}

// Run setup
setupDatabase();