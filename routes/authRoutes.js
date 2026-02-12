const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const authenticateToken = require('../middleware/auth');

// ================= REGISTER =================
router.post('/register', async (req, res) => {
    const { username, password, email } = req.body;

    if (!username || !password || !email) {
        return res.status(400).json({ error: 'Missing fields' });
    }

    try {
        const password_hash = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO user_data(username, email, password_hash) VALUES ($1,$2,$3) RETURNING id, username, email',
            [username, email, password_hash]
        );

        res.status(201).json({
            message: 'Register success',
            user: result.rows[0]
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Register failed' });
    }
});

// ================= LOGIN =================
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await pool.query(
            'SELECT * FROM user_data WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = jwt.sign(
            { userId: user.id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
        );

        res.json({
            message: 'Login success',
            token,
            user: { id: user.id, username: user.username }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Login failed' });
    }
});

// ================= PROFILE =================
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, username, email, created_at FROM user_data WHERE id = $1',
            [req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching profile' });
    }
});

// ================= VERIFY TOKEN =================
router.get('/verify', authenticateToken, (req, res) => {
    res.json({
        valid: true,
        user: {
            userId: req.user.userId,
            username: req.user.username
        }
    });
});

// ================= CHANGE PASSWORD =================
router.put('/change-password', authenticateToken, async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    try {
        const result = await pool.query(
            'SELECT password_hash FROM user_data WHERE id = $1',
            [req.user.userId]
        );

        const isMatch = await bcrypt.compare(oldPassword, result.rows[0].password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Old password incorrect' });
        }

        const newHash = await bcrypt.hash(newPassword, 10);
        await pool.query(
            'UPDATE user_data SET password_hash = $1 WHERE id = $2',
            [newHash, req.user.userId]
        );

        res.json({ message: 'Password updated' });
    } catch (err) {
        res.status(500).json({ error: 'Change password failed' });
    }
});

// ================= DELETE ACCOUNT =================
router.delete('/account', authenticateToken, async (req, res) => {
    const { password } = req.body;

    try {
        const result = await pool.query(
            'SELECT password_hash FROM user_data WHERE id = $1',
            [req.user.userId]
        );

        const isMatch = await bcrypt.compare(password, result.rows[0].password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Password incorrect' });
        }

        await pool.query('DELETE FROM user_data WHERE id = $1', [req.user.userId]);
        res.json({ message: 'Account deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Delete failed' });
    }
});

module.exports = router;
