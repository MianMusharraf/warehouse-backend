// routes/qr.js - QR Code Generation Routes

const express = require('express');
const QRCode = require('qrcode');
const pool = require('../config/database');
const { verifyToken, isAdmin } = require('../middleware/auth');

const router = express.Router();

// All routes require admin authentication
router.use(verifyToken, isAdmin);

// ============= GENERATE QR CODE =============
// POST /api/qr/generate
// Body: { palletId }
// Returns: Base64 encoded QR code image
router.post('/generate', async (req, res) => {
  try {
    const { palletId } = req.body;

    if (!palletId) {
      return res.status(400).json({ error: 'Pallet ID required' });
    }

    // Get pallet details
    const result = await pool.query(
      'SELECT * FROM pallets WHERE pallet_id = $1',
      [palletId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pallet not found' });
    }

    const pallet = result.rows[0];

    // Create QR code data object with all metadata
    const qrData = {
      palletId: pallet.pallet_id,
      itemCode: pallet.item_code,
      itemName: pallet.item_name,
      itemQuantity: pallet.item_quantity,
      unitNo: pallet.unit_no,
      weightKg: pallet.weight_kg,
      productionDate: pallet.production_date,
      expiryDate: pallet.expiry_date,
      status: pallet.status,
      warehouseLocation: pallet.warehouse_location,
      destination: pallet.destination
    };

    // Convert to JSON string for QR code
    const qrDataString = JSON.stringify(qrData);

    // Generate QR code as Data URL (Base64)
    const qrCodeDataURL = await QRCode.toDataURL(qrDataString, {
      errorCorrectionLevel: 'H', // High error correction
      type: 'image/png',
      width: 400,
      margin: 2
    });

    // Optionally save QR code URL to database
    await pool.query(
      'UPDATE pallets SET qr_code_url = $1 WHERE pallet_id = $2',
      [qrCodeDataURL, palletId]
    );

    res.json({
      message: 'QR code generated successfully',
      palletId: pallet.pallet_id,
      qrCode: qrCodeDataURL, // Base64 image
      metadata: qrData
    });
  } catch (error) {
    console.error('Generate QR code error:', error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// ============= GENERATE BULK QR CODES =============
// POST /api/qr/generate-bulk
// Body: { palletIds: ["P001", "P002", ...] }
router.post('/generate-bulk', async (req, res) => {
  try {
    const { palletIds } = req.body;

    if (!palletIds || !Array.isArray(palletIds) || palletIds.length === 0) {
      return res.status(400).json({ error: 'Array of pallet IDs required' });
    }

    // Get all pallets
    const result = await pool.query(
      'SELECT * FROM pallets WHERE pallet_id = ANY($1)',
      [palletIds]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No pallets found' });
    }

    // Generate QR codes for all pallets
    const qrCodes = await Promise.all(
      result.rows.map(async (pallet) => {
        const qrData = {
          palletId: pallet.pallet_id,
          itemCode: pallet.item_code,
          itemName: pallet.item_name,
          itemQuantity: pallet.item_quantity,
          unitNo: pallet.unit_no,
          weightKg: pallet.weight_kg,
          productionDate: pallet.production_date,
          expiryDate: pallet.expiry_date,
          status: pallet.status,
          warehouseLocation: pallet.warehouse_location,
          destination: pallet.destination
        };

        const qrDataString = JSON.stringify(qrData);
        const qrCodeDataURL = await QRCode.toDataURL(qrDataString, {
          errorCorrectionLevel: 'H',
          type: 'image/png',
          width: 400,
          margin: 2
        });

        // Update database
        await pool.query(
          'UPDATE pallets SET qr_code_url = $1 WHERE pallet_id = $2',
          [qrCodeDataURL, pallet.pallet_id]
        );

        return {
          palletId: pallet.pallet_id,
          itemName: pallet.item_name,
          qrCode: qrCodeDataURL
        };
      })
    );

    res.json({
      message: `${qrCodes.length} QR codes generated successfully`,
      qrCodes
    });
  } catch (error) {
    console.error('Generate bulk QR codes error:', error);
    res.status(500).json({ error: 'Failed to generate QR codes' });
  }
});

// ============= GET QR CODE FOR PALLET =============
// GET /api/qr/:palletId
router.get('/:palletId', async (req, res) => {
  try {
    const { palletId } = req.params;

    const result = await pool.query(
      'SELECT pallet_id, item_name, qr_code_url FROM pallets WHERE pallet_id = $1',
      [palletId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pallet not found' });
    }

    const pallet = result.rows[0];

    if (!pallet.qr_code_url) {
      return res.status(404).json({ 
        error: 'QR code not generated for this pallet',
        message: 'Use POST /api/qr/generate to create QR code'
      });
    }

    res.json({
      palletId: pallet.pallet_id,
      itemName: pallet.item_name,
      qrCode: pallet.qr_code_url
    });
  } catch (error) {
    console.error('Get QR code error:', error);
    res.status(500).json({ error: 'Failed to fetch QR code' });
  }
});

// ============= DECODE QR CODE =============
// POST /api/qr/decode
// Body: { qrData: "scanned QR string" }
// Used by mobile app to decode scanned QR codes
router.post('/decode', async (req, res) => {
  try {
    const { qrData } = req.body;

    if (!qrData) {
      return res.status(400).json({ error: 'QR data required' });
    }

    // Parse QR data
    let palletData;
    try {
      palletData = JSON.parse(qrData);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid QR code format' });
    }

    // Verify pallet exists and get latest data
    const result = await pool.query(
      'SELECT * FROM pallets WHERE pallet_id = $1',
      [palletData.palletId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pallet not found in database' });
    }

    res.json({
      message: 'QR code decoded successfully',
      pallet: result.rows[0]
    });
  } catch (error) {
    console.error('Decode QR code error:', error);
    res.status(500).json({ error: 'Failed to decode QR code' });
  }
});

module.exports = router;