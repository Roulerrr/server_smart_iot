const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authenticateToken = require('../middleware/auth');

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

// ===== API เดิมที่มีอยู่แล้ว =====
// POST /api/device/add-device
// POST /api/device/register-device
// GET /api/device/my-devices

// ===== API ใหม่ที่ควรเพิ่ม =====

// 1. Get Latest Sensor Data for a Device
router.get('/:deviceId/sensor-data/latest', authenticateToken, async (req, res) => {
    try {
        // ตรวจสอบว่า device นี้เป็นของ user ที่ login อยู่
        const deviceCheck = await pool.query(
            'SELECT * FROM data_device WHERE id = $1 AND user_id = $2',
            [req.params.deviceId, req.user.userId]
        );

        if (deviceCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Device not found or unauthorized' });
        }

        // ดึงข้อมูล sensor ล่าสุด
        const result = await pool.query(
            `SELECT * FROM sensor_data 
             WHERE device_id = $1 
             ORDER BY timestamp DESC 
             LIMIT 1`,
            [req.params.deviceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No sensor data found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching latest sensor data:', err);
        res.status(500).json({ error: 'Error fetching sensor data' });
    }
});

// 2. Get Sensor Data History (with filters)
router.get('/:deviceId/sensor-data', authenticateToken, async (req, res) => {
    try {
        const { limit = 100, hours = 24, startDate, endDate } = req.query;

        // ตรวจสอบว่า device นี้เป็นของ user ที่ login อยู่
        const deviceCheck = await pool.query(
            'SELECT * FROM data_device WHERE id = $1 AND user_id = $2',
            [req.params.deviceId, req.user.userId]
        );

        if (deviceCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Device not found or unauthorized' });
        }

        let query;
        let params;

        // ถ้ามี startDate และ endDate
        if (startDate && endDate) {
            query = `
                SELECT * FROM sensor_data 
                WHERE device_id = $1 
                AND timestamp BETWEEN $2 AND $3
                ORDER BY timestamp DESC 
                LIMIT $4
            `;
            params = [req.params.deviceId, startDate, endDate, limit];
        } 
        // ถ้าระบุแค่ hours
        else {
            query = `
                SELECT * FROM sensor_data 
                WHERE device_id = $1 
                AND timestamp > NOW() - INTERVAL '${parseInt(hours)} hours'
                ORDER BY timestamp DESC 
                LIMIT $2
            `;
            params = [req.params.deviceId, limit];
        }

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching sensor data:', err);
        res.status(500).json({ error: 'Error fetching sensor data' });
    }
});

// 3. Get Device Statistics (สถิติของอุปกรณ์)
router.get('/:deviceId/stats', authenticateToken, async (req, res) => {
    try {
        const { hours = 24 } = req.query;

        // ตรวจสอบว่า device นี้เป็นของ user
        const deviceCheck = await pool.query(
            'SELECT * FROM data_device WHERE id = $1 AND user_id = $2',
            [req.params.deviceId, req.user.userId]
        );

        if (deviceCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Device not found or unauthorized' });
        }

        // คำนวณสถิติ
        const result = await pool.query(
            `SELECT 
                COUNT(*) as total_records,
                AVG(temperature) as avg_temperature,
                MAX(temperature) as max_temperature,
                MIN(temperature) as min_temperature,
                AVG(humidity) as avg_humidity,
                MAX(humidity) as max_humidity,
                MIN(humidity) as min_humidity,
                AVG(light_level) as avg_light,
                AVG(soil_moisture) as avg_soil,
                AVG(co2_ppm) as avg_co2
             FROM sensor_data 
             WHERE device_id = $1 
             AND timestamp > NOW() - INTERVAL '${parseInt(hours)} hours'`,
            [req.params.deviceId]
        );

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching stats:', err);
        res.status(500).json({ error: 'Error fetching statistics' });
    }
});

// 4. Delete Device
router.delete('/:deviceId', authenticateToken, async (req, res) => {
    try {
        // ตรวจสอบว่า device นี้เป็นของ user
        const deviceCheck = await pool.query(
            'SELECT * FROM data_device WHERE id = $1 AND user_id = $2',
            [req.params.deviceId, req.user.userId]
        );

        if (deviceCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Device not found or unauthorized' });
        }

        // ลบ device (sensor_data จะถูกลบอัตโนมัติด้วย CASCADE)
        await pool.query('DELETE FROM data_device WHERE id = $1', [req.params.deviceId]);

        res.json({ message: 'Device deleted successfully' });
    } catch (err) {
        console.error('Error deleting device:', err);
        res.status(500).json({ error: 'Error deleting device' });
    }
});

// 5. Update Device Name
router.put('/:deviceId', authenticateToken, async (req, res) => {
    try {
        const { device_name } = req.body;

        // ตรวจสอบว่า device นี้เป็นของ user
        const deviceCheck = await pool.query(
            'SELECT * FROM data_device WHERE id = $1 AND user_id = $2',
            [req.params.deviceId, req.user.userId]
        );

        if (deviceCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Device not found or unauthorized' });
        }

        // อัพเดทชื่อ
        const result = await pool.query(
            'UPDATE data_device SET device_name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
            [device_name, req.params.deviceId]
        );

        res.json({ message: 'Device updated successfully', device: result.rows[0] });
    } catch (err) {
        console.error('Error updating device:', err);
        res.status(500).json({ error: 'Error updating device' });
    }
});

// 6. Get Device by ID (with latest sensor data)
router.get('/:deviceId', authenticateToken, async (req, res) => {
    try {
        // ตรวจสอบว่า device นี้เป็นของ user
        const deviceResult = await pool.query(
            'SELECT * FROM data_device WHERE id = $1 AND user_id = $2',
            [req.params.deviceId, req.user.userId]
        );

        if (deviceResult.rows.length === 0) {
            return res.status(404).json({ error: 'Device not found or unauthorized' });
        }

        const device = deviceResult.rows[0];

        // ดึงข้อมูล sensor ล่าสุด
        const sensorResult = await pool.query(
            `SELECT * FROM sensor_data 
             WHERE device_id = $1 
             ORDER BY timestamp DESC 
             LIMIT 1`,
            [req.params.deviceId]
        );

        // รวมข้อมูล
        const response = {
            ...device,
            latest_sensor_data: sensorResult.rows.length > 0 ? sensorResult.rows[0] : null
        };

        res.json(response);
    } catch (err) {
        console.error('Error fetching device:', err);
        res.status(500).json({ error: 'Error fetching device' });
    }
});

module.exports = router;