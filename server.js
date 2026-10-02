const WebSocket = require('ws');
const http = require('http');
const mongoose = require('mongoose');

// Bộ nhớ RAM lưu trữ tạm thời nếu CSDL MongoDB Atlas chưa sẵn sàng
const ramLogs = [];

// Kết nối CSDL MongoDB Atlas
const MONGO_URI = process.env.MONGO_URI || "";
let isDbConnected = false;

if (MONGO_URI && MONGO_URI.startsWith("mongodb")) {
    mongoose.connect(MONGO_URI)
        .then(() => {
            console.log("🟢 [DB]: Đã kết nối thành công Database");
            isDbConnected = true;
        })
        .catch(err => console.error("⚠️ [DB Warning]: Chưa kết nối được dữ liệu, sử dụng bộ nhớ RAM tạm thời.", err.message));
} else {
    console.log("⚠️ [DB Warning]: Chưa cấu hình MONGO_URI hợp lệ, hệ thống chạy ở chế độ lưu log trên RAM.");
}

// Định nghĩa Schema CSDL
const LogSchema = new mongoose.Schema({
    eventType: String,
    gas: Number,
    vib: Number,
    water: Boolean,
    door: Boolean,
    timestamp: { type: Date, default: Date.now }
});
const SystemLog = mongoose.model('SystemLog', LogSchema);

// Hàm ghi log dữ liệu
async function saveLog(logData) {
    logData.timestamp = new Date();
    ramLogs.unshift(logData);
    if (ramLogs.length > 500) ramLogs.pop(); 

    if (isDbConnected) {
        try { await SystemLog.create(logData); } catch (e) {}
    }
}

const PORT = process.env.PORT || 8080;

// Khởi tạo HTTP Server
const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200); res.end(); return;
    }

    if (req.url.startsWith('/api/logs')) {
        const urlParams = new URLSearchParams(req.url.split('?')[1]);
        const dateStr = urlParams.get('date'); 

        try {
            let logs = [];
            if (isDbConnected) {
                let query = {};
                if (dateStr) {
                    const startDate = new Date(dateStr); startDate.setHours(0, 0, 0, 0);
                    const endDate = new Date(dateStr); endDate.setHours(23, 59, 59, 999);
                    query.timestamp = { $gte: startDate,$lte: endDate };
                }
                logs = await SystemLog.find(query).sort({ timestamp: -1 }).limit(300);
            } else {
                logs = ramLogs.filter(item => {
                    if (!dateStr) return true;
                    const itemDate = new Date(item.timestamp).toISOString().split('T')[0];
                    return itemDate === dateStr;
                });
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(logs));
        } catch (err) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(ramLogs));
        }
    } 
    else if (req.url === '/' || req.url === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(HTML_DASHBOARD);
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end("404 Not Found");
    }
});

// Khởi tạo WebSocket Server
const wss = new WebSocket.Server({ server });
let lastDoorState = null;

wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
        const dataStr = message.toString();

        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) client.send(dataStr);
        });

        try {
            const data = JSON.parse(dataStr);
            if (data.door !== undefined) {
                if (lastDoorState !== null && lastDoorState !== data.door) {
                    const eventType = data.door ? "DOOR_OPEN" : "DOOR_CLOSE";
                    saveLog({ eventType, gas: data.gas, vib: data.vib, water: data.water, door: data.door });
                }
                lastDoorState = data.door;
            }
        } catch (e) {
            if (['ROOM_LIGHT_ON', 'ROOM_LIGHT_OFF', 'OPEN_DOOR', 'CLOSE_DOOR'].includes(dataStr)) {
                saveLog({ eventType: dataStr });
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Server đang chạy thành công trên Port: ${PORT}`);
});

const HTML_DASHBOARD = `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NEXUS - SMART HOME COMMAND CENTER</title>
    <!-- Phông chữ cao cấp (Rajdhani cho số liệu, Inter cho văn bản) -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Rajdhani:wght@500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        :root {
            --bg-deep: #030712;
            --glass-bg: rgba(17, 24, 39, 0.45);
            --glass-border: rgba(255, 255, 255, 0.08);
            --glass-highlight: rgba(255, 255, 255, 0.15);
            
            --neon-cyan: #00f3ff;
            --neon-emerald: #10b981;
            --neon-red: #ef4444;
            --neon-purple: #8b5cf6;
            
            --text-main: #f8fafc;
            --text-dim: #94a3b8;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }

        body {
            background-color: var(--bg-deep);
            background-image: 
                radial-gradient(circle at 15% 50%, rgba(0, 243, 255, 0.08), transparent 25%),
                radial-gradient(circle at 85% 30%, rgba(16, 185, 129, 0.08), transparent 25%);
            color: var(--text-main);
            min-height: 100vh;
            padding: 30px 20px;
            display: flex; flex-direction: column; align-items: center;
        }

        /* Cuộn thanh siêu mượt */
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--neon-cyan); }

        .container { width: 100%; max-width: 1280px; }

        /* Header Style Tương lai */
        header {
            display: flex; justify-content: space-between; align-items: center;
            background: var(--glass-bg); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
            border: 1px solid var(--glass-border); border-top: 1px solid var(--glass-highlight);
            padding: 16px 32px; border-radius: 20px; margin-bottom: 30px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        }
        .brand { display: flex; align-items: center; gap: 16px; }
        .brand i { font-size: 32px; color: var(--neon-cyan); text-shadow: 0 0 15px var(--neon-cyan); }
        .brand h1 { font-family: 'Rajdhani', sans-serif; font-size: 26px; font-weight: 700; letter-spacing: 2px; }

        .system-info { display: flex; align-items: center; gap: 24px; }
        .time-display { 
            font-family: 'Rajdhani', sans-serif; font-size: 20px; font-weight: 600; 
            color: var(--neon-cyan); text-shadow: 0 0 10px rgba(0,243,255,0.5);
            display: flex; align-items: center; gap: 8px; 
        }

        .status-badge {
            display: inline-flex; align-items: center; gap: 8px; padding: 8px 18px;
            border-radius: 30px; font-size: 13px; font-weight: 600; letter-spacing: 1px;
            background: rgba(0, 0, 0, 0.3); border: 1px solid var(--glass-border);
            transition: 0.3s;
        }
        .dot { width: 8px; height: 8px; border-radius: 50%; background-color: var(--neon-red); box-shadow: 0 0 10px var(--neon-red); }
        .status-badge.online { border-color: rgba(16, 185, 129, 0.4); }
        .status-badge.online .dot { background-color: var(--neon-emerald); box-shadow: 0 0 15px var(--neon-emerald); }
        .status-badge.online span { color: var(--neon-emerald); text-shadow: 0 0 10px rgba(16, 185, 129, 0.4); }

        /* Khung Grid dữ liệu 3D */
        .grid-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 24px; margin-bottom: 30px; }
        .card { 
            background: var(--glass-bg); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
            border: 1px solid var(--glass-border); border-top: 1px solid var(--glass-highlight);
            border-radius: 20px; padding: 24px; 
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative; overflow: hidden;
        }
        .card:hover { transform: translateY(-5px); box-shadow: 0 15px 40px rgba(0,0,0,0.5); border-color: rgba(255,255,255,0.2); }
        
        .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .card-title { font-size: 13px; font-weight: 600; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1.5px; }
        .card-icon { font-size: 22px; color: var(--text-dim); opacity: 0.8; }
        
        .value-large { 
            font-family: 'Rajdhani', sans-serif; font-size: 46px; font-weight: 700; 
            color: var(--text-main); margin-bottom: 4px; line-height: 1;
        }
        .unit-label { font-size: 13px; color: var(--text-dim); font-weight: 500; }

        /* Định dạng màu sắc từng Card khi Active */
        #cardGas .card-icon { color: var(--neon-emerald); }
        #cardVib .card-icon { color: var(--neon-cyan); }
        #cardWater .card-icon { color: var(--neon-purple); }

        /* Cảnh báo nhấp nháy Đỏ */
        .card.hazard { border-color: var(--neon-red); background: rgba(239, 68, 68, 0.05); }
        .card.hazard .value-large, .card.hazard .card-icon { color: var(--neon-red); text-shadow: 0 0 20px rgba(239, 68, 68, 0.6); }

        /* Bố cục Biểu đồ và Điều khiển */
        .controls-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; margin-bottom: 30px;}
        @media (max-width: 900px) { .controls-grid { grid-template-columns: 1fr; } }
        .chart-container { height: 280px; width: 100%; position: relative; }

        /* Nút bấm Cyberpunk */
        .btn-group { display: flex; gap: 12px; width: 100%; margin-top: 15px; }
        .btn {
            flex: 1; padding: 14px; border: none; border-radius: 12px;
            font-size: 14px; font-weight: 600; letter-spacing: 1px; cursor: pointer;
            display: flex; align-items: center; justify-content: center; gap: 8px; 
            background: rgba(0,0,0,0.4); border: 1px solid var(--glass-border); color: var(--text-main);
            transition: all 0.3s ease; position: relative; overflow: hidden;
        }
        
        /* Hiệu ứng Nút Bật Đèn / Mở Cửa (Xanh Ngọc/Cyan) */
        .btn-action { color: var(--neon-cyan); border-color: rgba(0, 243, 255, 0.3); }
        .btn-action:hover { background: rgba(0, 243, 255, 0.1); border-color: var(--neon-cyan); box-shadow: 0 0 20px rgba(0, 243, 255, 0.3); }
        
        /* Hiệu ứng Nút Tắt Đèn / Đóng Cửa (Đỏ/Hồng) */
        .btn-danger { color: var(--neon-red); border-color: rgba(239, 68, 68, 0.3); }
        .btn-danger:hover { background: rgba(239, 68, 68, 0.1); border-color: var(--neon-red); box-shadow: 0 0 20px rgba(239, 68, 68, 0.3); }

        /* Bảng Dữ Liệu Tra Cứu Xịn Xò */
        .filter-box { 
            display: flex; gap: 15px; align-items: center; 
            background: rgba(0,0,0,0.2); padding: 16px 20px; 
            border-radius: 14px; border: 1px solid var(--glass-border); margin-bottom: 20px; 
        }
        input[type="date"] { 
            padding: 10px 16px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); 
            background: rgba(0,0,0,0.5); color: var(--neon-cyan); font-family: 'Rajdhani', sans-serif; 
            font-size: 16px; font-weight: 600; outline: none; letter-spacing: 1px;
        }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1) hue-rotate(180deg); cursor: pointer; }
        
        .log-table-wrapper { max-height: 350px; overflow-y: auto; border-radius: 12px; }
        table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 14px; text-align: left; }
        th { 
            background: rgba(0, 0, 0, 0.6); color: var(--text-dim); padding: 16px; 
            position: sticky; top: 0; backdrop-filter: blur(10px); z-index: 10;
            text-transform: uppercase; letter-spacing: 1px; font-size: 12px; font-weight: 600;
        }
        td { padding: 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.03); background: rgba(255,255,255, 0.01); transition: 0.2s; }
        tr:hover td { background: rgba(255, 255, 255, 0.04); }

        .badge-tag { padding: 6px 14px; border-radius: 8px; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
        .tag-door-open { background: rgba(0, 243, 255, 0.1); border: 1px solid var(--neon-cyan); color: var(--neon-cyan); box-shadow: 0 0 10px rgba(0, 243, 255, 0.2); }
        .tag-door-close { background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255,255,255,0.2); color: var(--text-dim); }
        .tag-light-on { background: rgba(16, 185, 129, 0.1); border: 1px solid var(--neon-emerald); color: var(--neon-emerald); box-shadow: 0 0 10px rgba(16, 185, 129, 0.2);}
        .tag-light-off { background: rgba(239, 68, 68, 0.1); border: 1px solid var(--neon-red); color: var(--neon-red); box-shadow: 0 0 10px rgba(239, 68, 68, 0.2);}
    </style>
</head>
<body>
<div class="container">
    <header>
        <div class="brand"><i class="fa-brands fa-space-awesome"></i><h1>NEXUS CORE</h1></div>
        <div class="system-info">
            <div class="time-display"><i class="fa-solid fa-clock"></i> <span id="clock">00:00:00</span></div>
            <div class="status-badge" id="wsBadge"><div class="dot"></div><span id="wsStatus">CONNECTING...</span></div>
        </div>
    </header>

    <div class="grid-cards">
        <div class="card" id="cardGas">
            <div class="card-header"><span class="card-title">Air Quality (MQ-2)</span><i class="fa-solid fa-wind card-icon"></i></div>
            <div class="value-large" id="valGas">--</div><span class="unit-label">PPM INDEX</span>
        </div>
        <div class="card" id="cardVib">
            <div class="card-header"><span class="card-title">Seismic Sensor</span><i class="fa-solid fa-wave-square card-icon"></i></div>
            <div class="value-large" id="valVib">--</div><span class="unit-label">AMPLITUDE</span>
        </div>
        <div class="card" id="cardWater">
            <div class="card-header"><span class="card-title">Flood Detection</span><i class="fa-solid fa-droplet card-icon"></i></div>
            <div class="value-large" id="valWater" style="font-size: 32px; margin-top: 10px;">SECURE</div><span class="unit-label">STATUS</span>
        </div>
        <div class="card">
            <div class="card-header"><span class="card-title">Main Gate</span><i class="fa-solid fa-shield-halved card-icon"></i></div>
            <div class="value-large" id="valDoor" style="font-size: 32px; margin-top: 10px;">LOCKED</div>
            <div class="btn-group">
                <button class="btn btn-action" onclick="sendCommand('OPEN_DOOR')"><i class="fa-solid fa-unlock"></i> MỞ</button>
                <button class="btn btn-danger" onclick="sendCommand('CLOSE_DOOR')"><i class="fa-solid fa-lock"></i> ĐÓNG</button>
            </div>
        </div>
    </div>

    <div class="controls-grid">
        <div class="card">
            <div class="card-header"><span class="card-title">TELEMETRY GRAPH</span><i class="fa-solid fa-chart-area card-icon"></i></div>
            <div class="chart-container"><canvas id="telemetryChart"></canvas></div>
        </div>
        <div class="card" style="display: flex; flex-direction: column; justify-content: space-between;">
            <div>
                <div class="card-header"><span class="card-title">LIGHTING CONTROL</span><i class="fa-regular fa-lightbulb card-icon"></i></div>
                <p style="font-size: 13px; color: var(--text-dim); line-height: 1.6;">Remote control interface for main room lighting (GPIO_32). Encrypted transmission.</p>
            </div>
            <div class="btn-group" style="flex-direction: column; gap: 15px;">
                <button class="btn btn-action" style="padding: 16px;" onclick="sendCommand('ROOM_LIGHT_ON')"><i class="fa-solid fa-power-off"></i> BẬT ĐÈN PHÒNG</button>
                <button class="btn btn-danger" style="padding: 16px;" onclick="sendCommand('ROOM_LIGHT_OFF')"><i class="fa-solid fa-toggle-off"></i> TẮT ĐÈN</button>
            </div>
        </div>
    </div>

    <div class="card">
        <div class="card-header" style="margin-bottom: 0;"><span class="card-title"><i class="fa-solid fa-database"></i> SYSTEM LOGS & AUDIT</span></div>
        <div class="filter-box" style="margin-top: 20px;">
            <label for="searchDate" style="font-size: 13px; color: var(--text-dim); font-weight: 600;">QUERY DATE:</label>
            <input type="date" id="searchDate">
            <button class="btn btn-action" style="width: auto; padding: 10px 20px;" onclick="fetchLogsByDate()"><i class="fa-solid fa-satellite-dish"></i> QUÉT DỮ LIỆU</button>
        </div>
        <div class="log-table-wrapper">
            <table>
                <thead>
                    <tr><th>Timestamp</th><th>Sự Kiện</th><th>Khí Gas</th><th>Rung Chấn</th><th>Cảm Biến Ngập</th><th>Bảo Mật Cửa</th></tr>
                </thead>
                <tbody id="logTableBody">
                    <tr><td colspan="6" style="text-align:center; color: var(--text-dim); padding: 40px 0;">INITIATING DATABASE CONNECTION...</td></tr>
                </tbody>
            </table>
        </div>
    </div>
</div>

<script>
    setInterval(() => { document.getElementById('clock').innerText = new Date().toLocaleTimeString(); }, 1000);
    document.getElementById('searchDate').valueAsDate = new Date();

    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = "'Inter', sans-serif";
    
    const ctx = document.getElementById('telemetryChart').getContext('2d');
    
    // Tạo gradient siêu đẹp cho biểu đồ
    let gradGas = ctx.createLinearGradient(0, 0, 0, 400);
    gradGas.addColorStop(0, 'rgba(16, 185, 129, 0.5)');
    gradGas.addColorStop(1, 'rgba(16, 185, 129, 0)');
    
    const telemetryChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { 
                    label: 'Gas (PPM)', data: [], 
                    borderColor: '#10b981', backgroundColor: gradGas, 
                    borderWidth: 2, pointRadius: 0, tension: 0.4, fill: true 
                },
                { 
                    label: 'Vibration', data: [], 
                    borderColor: '#00f3ff', backgroundColor: 'transparent', 
                    borderWidth: 2, pointRadius: 0, tension: 0.4 
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { display: false } },
            scales: { 
                x: { grid: { display: false, color: 'rgba(255,255,255,0.05)' } }, 
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, border: { dash: [4, 4] } } 
            }
        }
    });

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = \`\${protocol}//\${location.host}\`;
    let ws;

    function connectWebSocket() {
        ws = new WebSocket(wsUrl);
        ws.onopen = () => {
            document.getElementById('wsBadge').className = "status-badge online";
            document.getElementById('wsStatus').innerText = "SYSTEM ONLINE";
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
                        document.getElementById('valWater').innerText = "WARNING";
                        document.getElementById('valWater').style.color = "var(--neon-red)";
                        document.getElementById('cardWater').classList.add('hazard');
                    } else {
                        document.getElementById('valWater').innerText = "SECURE";
                        document.getElementById('valWater').style.color = "var(--text-main)";
                        document.getElementById('cardWater').classList.remove('hazard');
                    }
                }
                if (data.door !== undefined) {
                    const doorEl = document.getElementById('valDoor');
                    if (data.door) {
                        doorEl.innerText = "OPENED";
                        doorEl.style.color = "var(--neon-cyan)";
                        doorEl.style.textShadow = "0 0 15px var(--neon-cyan)";
                    } else {
                        doorEl.innerText = "LOCKED";
                        doorEl.style.color = "var(--text-main)";
                        doorEl.style.textShadow = "none";
                    }
                }
                if (data.gas !== undefined && data.vib !== undefined) {
                    if (telemetryChart.data.labels.length > 20) {
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
            document.getElementById('wsStatus').innerText = "DISCONNECTED";
            setTimeout(connectWebSocket, 3000);
        };
    }

    async function fetchLogsByDate() {
        const selectedDate = document.getElementById('searchDate').value;
        if (!selectedDate) return alert("Vui lòng chọn ngày!");

        const tbody = document.getElementById('logTableBody');
        tbody.innerHTML = \`<tr><td colspan="6" style="text-align:center; color: var(--neon-cyan); padding: 40px 0;"><i class="fa-solid fa-circle-notch fa-spin"></i> RETRIEVING DATA...</td></tr>\`;

        try {
            const response = await fetch(\`/api/logs?date=\${selectedDate}\`);
            const logs = await response.json();
            tbody.innerHTML = '';

            if (!logs || logs.length === 0) {
                tbody.innerHTML = \`<tr><td colspan="6" style="text-align:center; color: var(--text-dim); padding: 40px 0;">NO RECORDS FOUND FOR \${selectedDate}</td></tr>\`;
                return;
            }

            logs.forEach(log => {
                const date = new Date(log.timestamp);
                const timeStr = \`<span style="font-family:'Rajdhani',sans-serif;font-size:15px;font-weight:600;color:var(--text-dim)">\${date.getHours().toString().padStart(2,'0')}:\${date.getMinutes().toString().padStart(2,'0')}:\${date.getSeconds().toString().padStart(2,'0')}</span>\`;
                
                let eventText = log.eventType;
                let doorTag = \`<span class='badge-tag tag-door-close'>\${log.door ? "MỞ" : "ĐÓNG"}</span>\`;

                if (log.eventType === 'DOOR_OPEN') { eventText = "CỬA MỞ TỰ ĐỘNG"; doorTag = \`<span class='badge-tag tag-door-open'>OPENED</span>\`; }
                else if (log.eventType === 'DOOR_CLOSE') { eventText = "CỬA KHÓA TỰ ĐỘNG"; doorTag = \`<span class='badge-tag tag-door-close'>LOCKED</span>\`; }
                else if (log.eventType === 'ROOM_LIGHT_ON') { eventText = "BẬT ĐÈN PHÒNG"; doorTag = \`<span class='badge-tag tag-light-on'>BẬT NGUỒN</span>\`; }
                else if (log.eventType === 'ROOM_LIGHT_OFF') { eventText = "TẮT ĐÈN PHÒNG"; doorTag = \`<span class='badge-tag tag-light-off'>NGẮT NGUỒN</span>\`; }
                else if (log.eventType === 'OPEN_DOOR') { eventText = "USER: LỆNH MỞ CỬA"; doorTag = \`<span class='badge-tag tag-door-open'>UNLOCK</span>\`; }
                else if (log.eventType === 'CLOSE_DOOR') { eventText = "USER: LỆNH ĐÓNG CỬA"; doorTag = \`<span class='badge-tag tag-door-close'>LOCK</span>\`; }

                const row = document.createElement('tr');
                row.innerHTML = \`
                    <td>\${timeStr}</td>
                    <td style="color:var(--text-main); font-weight:500;">\${eventText}</td>
                    <td style="font-family:'Rajdhani'; font-size:16px;">\${log.gas !== undefined ? log.gas : '--'}</td>
                    <td style="font-family:'Rajdhani'; font-size:16px;">\${log.vib !== undefined ? log.vib : '--'}</td>
                    <td><span style="color:\${log.water ? 'var(--neon-red)' : 'var(--text-dim)'}">\${log.water ? 'CẢNH BÁO' : 'BÌNH THƯỜNG'}</span></td>
                    <td>\${doorTag}</td>
                \`;
                tbody.appendChild(row);
            });
        } catch (err) {
            tbody.innerHTML = \`<tr><td colspan="6" style="text-align:center; color: var(--neon-red); padding: 40px 0;">LỖI KẾT NỐI MÁY CHỦ!</td></tr>\`;
        }
    }

    function sendCommand(cmd) { if (ws && ws.readyState === WebSocket.OPEN) ws.send(cmd); }

    connectWebSocket();
    fetchLogsByDate();
</script>
</body>
</html>
`;
