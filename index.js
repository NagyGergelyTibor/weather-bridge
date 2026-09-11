const mqtt = require('mqtt');
const { InfluxDB, Point } = require('@influxdata/influxdb-client');
const http = require('http'); // ÚJ: Webszerver modul a felhős futtatáshoz

// --- 1. INFLUXDB BEÁLLÍTÁSOK (Biztonságosan) ---
const url = 'https://eu-central-1-1.aws.cloud2.influxdata.com';
const token = process.env.INFLUX_TOKEN; // A Render felületén fogjuk megadni!
const org = 'weather_station';
const bucket = 'weather_data';

if (!token) {
    console.error('Kritikus hiba: Nincs megadva az INFLUX_TOKEN környezeti változó!');
    process.exit(1);
}

const influxDB = new InfluxDB({ url, token });
const writeApi = influxDB.getWriteApi(org, bucket, 'ns');

// --- 2. MQTT BEÁLLÍTÁSOK ---
const mqttClient = mqtt.connect('mqtt://broker.hivemq.com');
const topic = 'szakdolgozat/idojaras/allomas1';

// --- 3. FOLYAMATOS LOGIKA ---
mqttClient.on('connect', () => {
    console.log('Sikeresen csatlakozva az MQTT brokerhez!');
    mqttClient.subscribe(topic, (err) => {
        if (!err) console.log(`Fülelés elindítva a(z) ${topic} csatornán...`);
    });
});

mqttClient.on('message', (topic, message) => {
    try {
        const data = JSON.parse(message.toString());
        const point = new Point('station_metrics')
            .floatField('temperature', data.temperature)
            .floatField('humidity', data.humidity)
            .floatField('pressure', data.pressure)
            .floatField('wind_speed', data.wind_speed)
            .floatField('wind_direction', data.wind_direction)
            .floatField('rain', data.rain)
            .floatField('lux', data.lux)
            .floatField('uv', data.uv)
            .floatField('battery_voltage', data.battery_voltage)
            // ÚJ: rendszerdiagnosztikai mezők
            .floatField('wifi_signal', data.wifi_signal)
            .floatField('internal_temp', data.internal_temp)
            .intField('packets_sent', data.packets_sent)
            .intField('sleep_cycles', data.sleep_cycles)
            .floatField('deep_sleep_pct', data.deep_sleep_pct);

        writeApi.writePoint(point);
        writeApi.flush()
            .then(() => console.log('✅ Adat mentve:', data))
            .catch(err => console.error('❌ InfluxDB hiba:', err));
    } catch (error) {
        console.error('❌ JSON feldolgozási hiba:', error);
    }
});
 
// --- 4. DUMMY WEBSZERVER (A Render.com miatt) ---
const port = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('A weather-bridge aktiv es mukodik!\n');
});

server.listen(port, () => {
    console.log(`Webszerver hallgatózik a ${port}-es porton.`);
});
