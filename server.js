require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const Websocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new Websocket.Server({ server });
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/device', require('./routes/deviceRoutes'));

// WebSocket Setup
require('./sockets/sensorSocket')(wss);

server.listen(PORT, () => {
    console.log(`Server & WebSocket is running on port: ${PORT}`);
});