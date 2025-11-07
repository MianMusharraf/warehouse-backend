-- database/schema.sql - PostgreSQL Database Schema
-- Run this file to create all necessary tables

-- ============= USERS TABLE =============
-- Stores FLO operators and Admin users
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'flo')),
    flo_id VARCHAR(50) UNIQUE, -- Only for FLO operators
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============= PALLETS TABLE =============
-- Main table storing all pallet information
CREATE TABLE IF NOT EXISTS pallets (
    id SERIAL PRIMARY KEY,
    pallet_id VARCHAR(50) UNIQUE NOT NULL,
    item_code VARCHAR(50) NOT NULL,
    item_name VARCHAR(100) NOT NULL,
    item_quantity INTEGER NOT NULL,
    unit_no VARCHAR(50),
    weight_kg DECIMAL(10, 2),
    production_date DATE,
    expiry_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'At Production',
    warehouse_location VARCHAR(50), -- e.g., "A-12-3"
    destination VARCHAR(100),
    qr_code_url TEXT, -- URL to QR code image
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (status IN (
        'At Production',
        'Picked from Production',
        'In Transit to Warehouse',
        'At Warehouse',
        'Picked for Delivery',
        'Out for Delivery',
        'Delivered'
    ))
);

-- ============= PALLET SCANS TABLE =============
-- Tracks every scan/movement of pallets (audit trail)
CREATE TABLE IF NOT EXISTS pallet_scans (
    id SERIAL PRIMARY KEY,
    pallet_id VARCHAR(50) NOT NULL REFERENCES pallets(pallet_id) ON DELETE CASCADE,
    flo_id VARCHAR(50) NOT NULL,
    flo_name VARCHAR(100) NOT NULL,
    previous_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    scan_location VARCHAR(50),
    latitude DECIMAL(10, 8), -- Optional: GPS coordinates
    longitude DECIMAL(11, 8),
    notes TEXT,
    scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (flo_id) REFERENCES users(flo_id) ON DELETE SET NULL
);

-- ============= SHIFTS TABLE =============
-- Track FLO work shifts
CREATE TABLE IF NOT EXISTS shifts (
    id SERIAL PRIMARY KEY,
    flo_id VARCHAR(50) NOT NULL REFERENCES users(flo_id),
    shift_date DATE NOT NULL,
    shift_type VARCHAR(20) CHECK (shift_type IN ('morning', 'afternoon', 'night')),
    clock_in TIMESTAMP,
    clock_out TIMESTAMP,
    pallets_handled INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(flo_id, shift_date, shift_type)
);

-- ============= INDEXES FOR PERFORMANCE =============
-- Speed up common queries
CREATE INDEX IF NOT EXISTS idx_pallets_status ON pallets(status);
CREATE INDEX IF NOT EXISTS idx_pallets_warehouse_location ON pallets(warehouse_location);
CREATE INDEX IF NOT EXISTS idx_pallet_scans_pallet_id ON pallet_scans(pallet_id);
CREATE INDEX IF NOT EXISTS idx_pallet_scans_flo_id ON pallet_scans(flo_id);
CREATE INDEX IF NOT EXISTS idx_pallet_scans_date ON pallet_scans(scanned_at);
CREATE INDEX IF NOT EXISTS idx_shifts_flo_date ON shifts(flo_id, shift_date);

-- ============= SAMPLE ADMIN USER =============
-- Default admin account (password: admin123)
-- CHANGE THIS PASSWORD IMMEDIATELY AFTER FIRST LOGIN!
INSERT INTO users (username, password_hash, full_name, role) 
VALUES (
    'admin',
    '$2b$10$YourHashedPasswordHere', -- Will be generated in setup
    'System Administrator',
    'admin'
) ON CONFLICT (username) DO NOTHING;

-- ============= VIEWS FOR ANALYTICS =============
-- Current warehouse stock (only pallets at warehouse)
CREATE OR REPLACE VIEW current_warehouse_stock AS
SELECT 
    p.*,
    ps.flo_name as last_handled_by,
    ps.scanned_at as last_scan_time
FROM pallets p
LEFT JOIN LATERAL (
    SELECT flo_name, scanned_at 
    FROM pallet_scans 
    WHERE pallet_id = p.pallet_id 
    ORDER BY scanned_at DESC 
    LIMIT 1
) ps ON true
WHERE p.status = 'At Warehouse';

-- Daily FLO performance
CREATE OR REPLACE VIEW daily_flo_performance AS
SELECT 
    flo_id,
    flo_name,
    DATE(scanned_at) as scan_date,
    COUNT(DISTINCT pallet_id) as pallets_handled,
    COUNT(*) as total_scans
FROM pallet_scans
GROUP BY flo_id, flo_name, DATE(scanned_at)
ORDER BY scan_date DESC, pallets_handled DESC;