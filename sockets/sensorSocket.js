const pool = require('../config/db');

module.exports = (wss) => {
    wss.on('connection', (ws) => {
        console.log('ESP32 connected');

        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message);

                // --- ส่วนของ AUTH (MAC Address) ---
                if (data.type === 'auth') {
                    const result = await pool.query(
                        'SELECT id FROM data_device WHERE device_token = $1', 
                        [data.device_token]
                    );
                    
                    if (result.rows.length > 0) {
                        ws.deviceId = result.rows[0].id;
                        ws.send(JSON.stringify({ status: 'Authorized', deviceId: ws.deviceId }));
  b                  } else {
                        ws.send(JSON.stringify({ status: 'Unauthorized' }));
                        ws.close();
                    }
                }

                // --- ส่วนของ SENSOR READING ---
                if (data.type === 'sensor_reading' && ws.deviceId) {
                    const { temperature, humidity, light_level, soil_moisture, co2_ppm, rain_analog, relay_status } = data;
                    const queryText = `INSERT INTO sensor_data (device_id, temperature, humidity, light_level, soil_moisture, co2_ppm, rain_analog, relay_status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;
                    await pool.query(queryText, 
                        [ws.deviceId
                            , temperature
                            , humidity
                            , light_level
                            , soil_moisture
                            , co2_ppm
                            , rain_analog
                            , relay_status
                        ]);
                    console.log(`Data save for Devices ${ws.deviceId}`);

                    ws.send(JSON.stringify({
                        status: 'Data receives',
                        timestamp: new Date().toISOString()
                    }));
                }

                if(data.type === 'control_relay' && ws.deviceId) {

                    const controlData = {
                        type: 'relay_control',
                        relay_status: data.relay_status
                    };
                    ws.send(JSON.stringify(controlData));
                    console.log(`Relay control sent to Device ${ws.deviceId}: ${data.relay_status}`);
                }
            } catch (err) {
                console.error('WS Error:', err);
                ws.send(JSON.stringify({
                    status: 'error',
                    message: 'Error processing data'
                }));
            }
        });
       ws.on('close', () => {
        console.log('ESP32 disconnected');
       }) 

       ws.on('error', (error) => {
        console.error('WebSocket error:', error);
       });
    });
};

