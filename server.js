const WebSocket = require('ws');
const http = require('http');
const mongoose = require('mongoose');

// 1. CHUỖI KẾT NỐI MONGODB ATLAS
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://admin:123456@cluster0.mongodb.net/smarthome?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
    .then(() => console.log("🟢 [DB]: Đã kết nối thành công MongoDB Atlas"))
    .catch(err => console.error("🔴 [DB Error]: Lỗi kết nối CSDL:", err));

// Định nghĩa CSDL lưu nhật ký
const LogSchema = new mongoose.Schema({
    eventType: String,
    gas: Number,
    vib: Number,
    water: Boolean,
    door: Boolean,
    timestamp: { type: Date, default: Date.now }
});
const SystemLog = mongoose.model('SystemLog', LogSchema);

const PORT = process.env.PORT || 8080;

// 2. PHỤC VỤ DỮ LIỆU HTTP & GIAO DIỆN WEB DASHBOARD
const server = http.createServer(async (req, res) => {
    // CORS Header
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // API TRA CỨU LỊCH SỬ: /api/logs?date=YYYY-MM-DD
    if (req.url.startsWith('/api/logs')) {
        const urlParams = new URLSearchParams(req.url.split('?')[1]);
        const dateStr = urlParams.get('date'); 

        let query = {};
        if (dateStr) {
            const startDate = new Date(dateStr);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(dateStr);
            endDate.setHours(23, 59, 59, 999);
            
            query.timestamp = { $gte: startDate,$lte: endDate };
        }

        try {
            const logs = await SystemLog.find(query).sort({ timestamp: -1 }).limit(300);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(logs));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
    } 
    // GIAO DIỆN WEB DASHBOARD TRỰC TIẾP TẠI TRANG CHỦ "/"
    else if (req.url === '/' || req.url === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(HTML_DASHBOARD);
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end("404 Not Found");
    }
});

// 3. WEBSOCKET SERVER LOGIC
const wss = new WebSocket.Server({ server });
let lastDoorState = null;

wss.on('connection', (ws) => {
    console.log("⚡ [WS]: Có kết nối mới tới Server");

    ws.on('message', async (message) => {
        const dataStr = message.toString();

        // Broadcast gói tin tới tất cả Client kết nối (ESP32, Web Dashboard, App)
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) client.send(dataStr);
        });

        // Tự động lưu vết các biến động trạng thái Cửa vào MongoDB Atlas
        try {
            const data = JSON.parse(dataStr);
            if (data.door !== undefined) {
                if (lastDoorState !== null && lastDoorState !== data.door) {
                    const eventType = data.door ? "DOOR_OPEN" : "DOOR_CLOSE";
                    await SystemLog.create({
                        eventType: eventType,
                        gas: data.gas,
                        vib: data.vib,
                        water: data.water,
                        door: data.door
                    });
                    console.log(`📝 [DB Saved]: Sự kiện ${eventType}`);
                }
                lastDoorState = data.door;
            }
        } catch (e) {
            if (['ROOM_LIGHT_ON', 'ROOM_LIGHT_OFF', 'OPEN_DOOR'].includes(dataStr)) {
                SystemLog.create({ eventType: dataStr, timestamp: new Date() }).catch(() => {});
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Server đang chạy thành công trên Port: ${PORT}`);
});

// 4. MÃ NGUỒN GIAO DIỆN ĐẲNG CẤP (EMBEDDED HTML/CSS/JS)
const HTML_DASHBOARD = `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SMART HOME IOT DASHBOARD</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        :root {
            --bg-primary: #0a0e17;
            --card-bg: rgba(22, 30, 46, 0.7);
            --card-border: rgba(255, 255, 255, 0.08);
            --accent-green: #00e676;
            --accent-red: #ff5252;
            --accent-blue: #00e5ff;
            --accent-orange: #ff9100;
            --text-main: #f1f5f9;
            --text-sub: #94a3b8;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
        body {
            background-color: var(--bg-primary);
            background-image: 
                radial-gradient(at 10% 10%, rgba(0, 230, 118, 0.05) 0px, transparent 50%),
                radial-gradient(at 90% 90%, rgba(0, 229, 255, 0.05) 0px, transparent 50%);
            color: var(--text-main);
            min-height: 100vh;
            padding: 24px;
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .container { width: 100%; max-width: 1200px; }
        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: var(--card-bg);
            backdrop-filter: blur(12px);
            border: 1px solid var(--card-border);
            padding: 18px 28px;
            border-radius: 16px;
            margin-bottom: 24px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        .brand { display: flex; align-items: center; gap: 14px; }
        .brand i { font-size: 28px; color: var(--accent-green); }
        .brand h1 { font-size: 20px; font-weight: 700; }
        .system-info { display: flex; align-items: center; gap: 20px; }
        .time-display { font-size: 14px; color: var(--text-sub); font-weight: 600; display: flex; align-items: center; gap: 8px; }
        .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--card-border);
        }
        .dot { width: 8px; height: 8px; border-radius: 50%; background-color: var(--accent-red); }
        .status-badge.online .dot { background-color: var(--accent-green); box-shadow: 0 0 10px var(--accent-green); }
        .status-badge.online { color: var(--accent-green); border-color: rgba(0,230,118,0.3); }

        .grid-cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 20px;
            margin-bottom: 24px;
        }
        .card {
            background: var(--card-bg);
            backdrop-filter: blur(12px);
            border: 1px solid var(--card-border);
            border-radius: 16px;
            padding: 20px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            margin-bottom: 24px;
        }
        .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
        .card-title { font-size: 13px; font-weight: 600; color: var(--text-sub); text-transform: uppercase; letter-spacing: 0.8px; }
        .card-icon { font-size: 20px; color: var(--accent-blue); }
        .value-large { font-size: 36px; font-weight: 700; color: var(--text-main); margin-bottom: 4px; }
        .unit-label { font-size: 12px; color: var(--text-sub); font-weight: 500; }
        .card.hazard { border-color: var(--accent-red); background: rgba(255, 82, 82, 0.1); }
        .card.hazard .value-large, .card.hazard .card-icon { color: var(--accent-red); }

        .controls-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 20px; }
        @media (max-width: 900px) { .controls-grid { grid-template-columns: 1fr; } }
        .chart-container { height: 260px; width: 100%; position: relative; }
        .btn-group { display: flex; gap: 12px; width: 100%; margin-top: 10px; }
        .btn {
            flex: 1; padding: 12px; border: none; border-radius: 10px;
            font-size: 14px; font-weight: 600; cursor: pointer;
            display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s ease;
        }
        .btn-green { background: linear-gradient(135deg, #00e676, #00b0ff); color: #000; }
        .btn-red { background: linear-gradient(135deg, #ff5252, #ff1744); color: #fff; }
        .btn-blue { background: linear-gradient(135deg, #00e5ff, #2979ff); color: #000; width: 100%; }

        .filter-box {
            display: flex; gap: 15px; align-items: center;
            background: rgba(255, 255, 255, 0.03); padding: 12px 18px;
            border-radius: 12px; border: 1px solid var(--card-border); margin-bottom: 15px;
        }
        input[type="date"] {
            padding: 8px 12px; border-radius: 8px; border: 1px solid var(--card-border);
            background: #161e2e; color: #fff; outline: none;
        }
        .log-table-wrapper { max-height: 320px; overflow-y: auto; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; }
        th { background: rgba(255, 255, 255, 0.05); color: var(--text-sub); padding: 12px; position: sticky; top: 0; backdrop-filter: blur(10px); }
        td { padding: 12px; border-bottom: 1px solid var(--card-border); }
        .badge-tag { padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; display: inline-block; }
        .tag-door-open { background: rgba(0, 229, 255, 0.2); color: var(--accent-blue); }
        .tag-door-close { background: rgba(148, 163, 184, 0.2); color: var(--text-sub); }
        .tag-light-on { background: rgba(0, 230, 118, 0.2); color: var(--accent-green); }
        .tag-light-off { background: rgba(255, 82, 82, 0.2); color: var(--accent-red); }
        .tag-data { background: rgba(255, 145, 0, 0.2); color: var(--accent-orange); }
    </style>
</head>
<body>
<div class="container">
    <header>
        <div class="brand"><i class="fa-solid fa-microchip"></i><h1>D-N IOT DASHBOARD</h1></div>
        <div class="system-info">
            <div class="time-display"><i class="fa-regular fa-clock"></i> <span id="clock">00:00:00</span></div>
            <div class="status-badge" id="wsBadge"><div class="dot"></div><span id="wsStatus">ĐANG KẾT NỐI...</span></div>
        </div>
    </header>

    <div class="grid-cards">
        <div class="card" id="cardGas">
            <div class="card-header"><span class="card-title">Gas (MQ-2)</span><i class="fa-solid fa-wind card-icon"></i></div>
            <div class="value-large" id="valGas">--</div><span class="unit-label">ADC Index</span>
        </div>
        <div class="card" id="cardVib">
            <div class="card-header"><span class="card-title">Rung Chấn</span><i class="fa-solid fa-wave-square card-icon"></i></div>
            <div class="value-large" id="valVib">--</div><span class="unit-label">Biên độ</span>
        </div>
        <div class="card" id="cardWater">
            <div class="card-header"><span class="card-title">Ngập Nước</span><i class="fa-solid fa-droplet card-icon"></i></div>
            <div class="value-large" id="valWater" style="font-size: 22px;">AN TOÀN</div><span class="unit-label">Phao cơ</span>
        </div>
        <div class="card">
            <div class="card-header"><span class="card-title">Cửa An Ninh</span><i class="fa-solid fa-door-closed card-icon"></i></div>
            <div class="value-large" id="valDoor" style="font-size: 22px;">ĐÓNG</div>
            <button class="btn btn-blue" style="margin-top: 10px;" onclick="sendCommand('OPEN_DOOR')"><i class="fa-solid fa-lock-open"></i> MỞ CỬA (5S)</button>
        </div>
    </div>

    <div class="controls-grid">
        <div class="card">
            <div class="card-header"><span class="card-title">ĐỒ THỊ THỜI GIAN THỰC</span><i class="fa-solid fa-chart-line card-icon"></i></div>
            <div class="chart-container"><canvas id="telemetryChart"></canvas></div>
        </div>
        <div class="card" style="display: flex; flex-direction: column; justify-content: space-between;">
            <div>
                <div class="card-header"><span class="card-title">ĐÈN PHÒNG</span><i class="fa-solid fa-lightbulb card-icon"></i></div>
                <p style="font-size: 13px; color: var(--text-sub); margin-bottom: 15px;">Điều khiển Relay GPIO_32 từ xa.</p>
            </div>
            <div class="btn-group">
                <button class="btn btn-green" onclick="sendCommand('ROOM_LIGHT_ON')"><i class="fa-solid fa-power-off"></i> BẬT ĐÈN</button>
                <button class="btn btn-red" onclick="sendCommand('ROOM_LIGHT_OFF')"><i class="fa-solid fa-toggle-off"></i> TẮT ĐÈN</button>
            </div>
        </div>
    </div>

    <div class="card">
        <div class="card-header"><span class="card-title"><i class="fa-solid fa-calendar-days"></i> TRA CỨU LỊCH SỬ ĐÓNG / MỞ CỬA THEO NGÀY</span></div>
        <div class="filter-box">
            <label for="searchDate" style="font-size: 13px; color: var(--text-sub);">Chọn ngày:</label>
            <input type="date" id="searchDate">
            <button class="btn btn-blue" style="width: auto; padding: 8px 16px; font-size: 13px;" onclick="fetchLogsByDate()"><i class="fa-solid fa-magnifying-glass"></i> Lọc Lịch Sử</button>
        </div>
        <div class="log-table-wrapper">
            <table>
                <thead>
                    <tr><th>Thời Gian</th><th>Loại Sự Kiện</th><th>Khí Gas</th><th>Rung Chấn</th><th>Ngập Nước</th><th>Trạng Thái Cửa</th></tr>
                </thead>
                <tbody id="logTableBody">
                    <tr><td colspan="6" style="text-align:center; color: var(--text-sub);">Đang tải dữ liệu...</td></tr>
                </tbody>
            </table>
        </div>
    </div>
</div>

<script>
    setInterval(() => { document.getElementById('clock').innerText = new Date().toLocaleTimeString(); }, 1000);
    document.getElementById('searchDate').valueAsDate = new Date();

    const ctx = document.getElementById('telemetryChart').getContext('2d');
    const telemetryChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { label: 'Gas (ADC)', data: [], borderColor: '#00e676', backgroundColor: 'rgba(0, 230, 118, 0.05)', tension: 0.4, fill: true },
                { label: 'Rung Chấn', data: [], borderColor: '#00e5ff', backgroundColor: 'transparent', tension: 0.4 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#94a3b8' } } },
            scales: { x: { ticks: { color: '#64748b' } }, y: { ticks: { color: '#64748b' } } }
        }
    });

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = \`\${protocol}//\${location.host}\`;
    let ws;

    function connectWebSocket() {
        ws = new WebSocket(wsUrl);
        ws.onopen = () => {
            document.getElementById('wsBadge').className = "status-badge online";
            document.getElementById('wsStatus').innerText = "ONLINE";
        };
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const timeStr = new Date().toLocaleTimeString();

                if (data.gas !== undefined) {
                    document.getElementById('valGas').innerText = data.gas;
                    if (data.gas > 3000) document.getElementById('cardGas').classList.add('hazard');
                    else document.getElementById('cardGas').classList.remove('hazard');
                }
                if (data.vib !== undefined) {
                    document.getElementById('valVib').innerText = data.vib;
                    if (data.vib > 2500) document.getElementById('cardVib').classList.add('hazard');
                    else document.getElementById('cardVib').classList.remove('hazard');
                }
                if (data.water !== undefined) {
                    if (data.water) {
                        document.getElementById('valWater').innerText = "CẢNH BÁO!";
                        document.getElementById('cardWater').classList.add('hazard');
                    } else {
                        document.getElementById('valWater').innerText = "AN TOÀN";
                        document.getElementById('cardWater').classList.remove('hazard');
                    }
                }
                if (data.door !== undefined) {
                    document.getElementById('valDoor').innerText = data.door ? "ĐANG MỞ" : "ĐÓNG";
                }
                if (data.gas !== undefined && data.vib !== undefined) {
                    if (telemetryChart.data.labels.length > 15) {
                        telemetryChart.data.labels.shift();
                        telemetryChart.data.datasets[0].data.shift();
                        telemetryChart.data.datasets[1].data.shift();
                    }
                    telemetryChart.data.labels.push(timeStr);
                    telemetryChart.data.datasets[0].data.push(data.gas);
                    telemetryChart.data.datasets[1].data.push(data.vib);
                    telemetryChart.update();
                }
            } catch (e) {}
        };
        ws.onclose = () => {
            document.getElementById('wsBadge').className = "status-badge";
            document.getElementById('wsStatus').innerText = "MẤT KẾT NỐI";
            setTimeout(connectWebSocket, 3000);
        };
    }

    async function fetchLogsByDate() {
        const selectedDate = document.getElementById('searchDate').value;
        if (!selectedDate) return alert("Vui lòng chọn ngày!");

        const tbody = document.getElementById('logTableBody');
        tbody.innerHTML = \`<tr><td colspan="6" style="text-align:center; color: var(--text-sub);">Đang tải dữ liệu ngày \${selectedDate}...</td></tr>\`;

        try {
            const response = await fetch(\`/api/logs?date=\${selectedDate}\`);
            const logs = await response.json();
            tbody.innerHTML = '';

            if (!logs || logs.length === 0) {
                tbody.innerHTML = \`<tr><td colspan="6" style="text-align:center; color: var(--text-sub);">Không tìm thấy nhật ký sự kiện nào trong ngày \${selectedDate}.</td></tr>\`;
                return;
            }

            logs.forEach(log => {
                const date = new Date(log.timestamp);
                const timeStr = \`\${date.getHours().toString().padStart(2,'0')}:\${date.getMinutes().toString().padStart(2,'0')}:\${date.getSeconds().toString().padStart(2,'0')}\`;
                
                let eventText = log.eventType;
                let doorTag = \`<span class='badge-tag tag-data'>\${log.door ? "MỞ" : "ĐÓNG"}</span>\`;

                if (log.eventType === 'DOOR_OPEN') { eventText = "CỬA MỞ"; doorTag = \`<span class='badge-tag tag-door-open'>ĐANG MỞ</span>\`; }
                else if (log.eventType === 'DOOR_CLOSE') { eventText = "CỬA ĐÓNG"; doorTag = \`<span class='badge-tag tag-door-close'>ĐÃ ĐÓNG</span>\`; }
                else if (log.eventType === 'ROOM_LIGHT_ON') { eventText = "BẬT ĐÈN PHÒNG"; doorTag = \`<span class='badge-tag tag-light-on'>BẬT</span>\`; }
                else if (log.eventType === 'ROOM_LIGHT_OFF') { eventText = "TẮT ĐÈN PHÒNG"; doorTag = \`<span class='badge-tag tag-light-off'>TẮT</span>\`; }
                else if (log.eventType === 'OPEN_DOOR') { eventText = "LỆNH MỞ CỬA"; doorTag = \`<span class='badge-tag tag-door-open'>MỞ (5S)</span>\`; }

                const row = document.createElement('tr');
                row.innerHTML = \`
                    <td style="color: var(--text-sub);">\${timeStr}</td>
                    <td><strong>\${eventText}</strong></td>
                    <td>\${log.gas !== undefined ? log.gas : '--'}</td>
                    <td>\${log.vib !== undefined ? log.vib : '--'}</td>
                    <td>\${log.water ? 'NGẬP!' : 'BÌNH THƯỜNG'}</td>
                    <td>\${doorTag}</td>
                \`;
                tbody.appendChild(row);
            });
        } catch (err) {
            tbody.innerHTML = \`<tr><td colspan="6" style="text-align:center; color: var(--accent-red);">Lỗi kết nối Server tra cứu!</td></tr>\`;
        }
    }

    function sendCommand(cmd) { if (ws && ws.readyState === WebSocket.OPEN) ws.send(cmd); }

    connectWebSocket();
    fetchLogsByDate();
</script>
</body>
</html>
`;
