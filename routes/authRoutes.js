const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// Register
router.post('/register', async (req, res) => {
    const { username, password, email } = req.body;
    try {
        const password_hash = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO user_data(username, email, password_hash) VALUES ($1,$2,$3) RETURNING id, username',
            [username, email, password_hash]
        );
        res.status(201).json({ message: 'Register user Success', user: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Error' });
    }
});

// Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM user_data WHERE email =$1', [email]);
        if (result.rows.length === 0) return res.status(401).json({ error: 'Email or password failed' });

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(401).json({ error: 'Password failed' });

        const token = jwt.sign(
            { userId: user.id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
        );
        res.status(200).json({ message: 'Login success', token, user: { id: user.id, username: user.username } });
    } catch (err) {
        res.status(500).json({ error: 'Invalid email or password' });
    }
});

module.exports = router;