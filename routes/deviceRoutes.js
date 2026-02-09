const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authenticateToken = require('../middleware/auth');

// Add Device (มี 2 path ตามโค้ดเดิมของคุณ)
router.post(['/add-device', '/register-device'], authenticateToken, async (req, res) => {
    const { device_name, device_type, device_token } = req.body;
    const ownerId = req.user.userId;
    try {
        const result = await pool.query(
            'INSERT INTO data_device (user_id, device_name, device_type, device_token) VALUES ($1, $2, $3, $4) RETURNING *',
            [ownerId, device_name, device_type, device_token]
        );
        res.status(201).json({ message: 'Device added successfully', device: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Error adding device' });
    }
});

// Get User Devices
router.get('/my-devices', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM data_device WHERE user_id = $1', [req.user.userId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching devices' });
    }
});

module.exports = router;