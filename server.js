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
            console.log("🟢 [DB]: Đã kết nối thành công MongoDB Atlas");
            isDbConnected = true;
        })
        .catch(err => console.error("⚠️ [DB Warning]: Chưa kết nối được MongoDB, sử dụng bộ nhớ RAM tạm thời.", err.message));
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

// =========================================================================
// GIAO DIỆN SÁNG (LIGHT MODE) - TỐI GIẢN & CHUYÊN NGHIỆP
// =========================================================================
const HTML_DASHBOARD = `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hệ Thống Nhà Thông Minh</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        :root {
            --bg-body: #f4f7f6;
            --bg-card: #ffffff;
            --text-main: #2d3748;
            --text-sub: #718096;
            --border-color: #e2e8f0;
            --primary: #3182ce;
            --primary-hover: #2b6cb0;
            --success: #38a169;
            --danger: #e53e3e;
            --danger-hover: #c53030;
            --warning: #dd6b20;
            --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
        }

        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }

        body {
            background-color: var(--bg-body);
            color: var(--text-main);
            min-height: 100vh;
            padding: 30px 20px;
            display: flex; flex-direction: column; align-items: center;
        }

        .container { width: 100%; max-width: 1200px; }

        /* Header Trắng Tinh Tế */
        header {
            display: flex; justify-content: space-between; align-items: center;
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            padding: 20px 30px; border-radius: 12px; margin-bottom: 24px;
            box-shadow: var(--shadow);
        }
        .brand { display: flex; align-items: center; gap: 12px; }
        .brand i { font-size: 26px; color: var(--primary); }
        .brand h1 { font-size: 20px; font-weight: 700; color: var(--text-main); }

        .system-info { display: flex; align-items: center; gap: 20px; }
        .time-display { font-size: 15px; font-weight: 500; color: var(--text-sub); display: flex; align-items: center; gap: 8px; }

        .status-badge {
            display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px;
            border-radius: 20px; font-size: 13px; font-weight: 600;
            background: #f1f5f9; border: 1px solid var(--border-color); color: var(--text-sub);
        }
        .dot { width: 8px; height: 8px; border-radius: 50%; background-color: var(--danger); }
        .status-badge.online { background: #f0fff4; border-color: #c6f6d5; color: var(--success); }
        .status-badge.online .dot { background-color: var(--success); }

        /* Lưới thẻ thông tin */
        .grid-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 24px; }
        
        .card { 
            background: var(--bg-card); border: 1px solid var(--border-color);
            border-radius: 12px; padding: 24px; box-shadow: var(--shadow);
            transition: transform 0.2s;
        }
        .card:hover { transform: translateY(-3px); }
        
        .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
        .card-title { font-size: 14px; font-weight: 600; color: var(--text-sub); text-transform: uppercase; }
        .card-icon { font-size: 20px; color: var(--primary); opacity: 0.8; }
        
        .value-large { font-size: 38px; font-weight: 700; color: var(--text-main); margin-bottom: 4px; }
        .unit-label { font-size: 13px; color: var(--text-sub); }

        /* Cảnh báo */
        .card.hazard { border-color: #feb2b2; background: #fff5f5; }
        .card.hazard .value-large, .card.hazard .card-icon { color: var(--danger); }

        /* Layout Đồ thị và Điều khiển */
        .controls-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 20px; margin-bottom: 24px;}
        @media (max-width: 900px) { .controls-grid { grid-template-columns: 1fr; } }
        .chart-container { height: 280px; width: 100%; position: relative; }

        /* Nút Bấm Phẳng */
        .btn-group { display: flex; gap: 12px; width: 100%; margin-top: 15px; }
        .btn {
            flex: 1; padding: 12px; border: none; border-radius: 8px;
            font-size: 14px; font-weight: 600; cursor: pointer;
            display: flex; align-items: center; justify-content: center; gap: 8px; 
            transition: 0.2s; color: white;
        }
        .btn-primary { background-color: var(--primary); }
        .btn-primary:hover { background-color: var(--primary-hover); }
        
        .btn-danger { background-color: var(--danger); }
        .btn-danger:hover { background-color: var(--danger-hover); }

        .btn-outline { background-color: white; border: 1px solid var(--border-color); color: var(--text-main); }
        .btn-outline:hover { background-color: #f7fafc; }

        /* Bảng Dữ Liệu Lịch Sử */
        .filter-box { 
            display: flex; gap: 15px; align-items: center; 
            background: #f8fafc; padding: 16px; 
            border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 20px; 
        }
        input[type="date"] { 
            padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color); 
            font-size: 14px; outline: none; color: var(--text-main);
        }
        
        .log-table-wrapper { max-height: 400px; overflow-y: auto; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; text-align: left; }
        th { 
            background: #f8fafc; color: var(--text-sub); padding: 14px; 
            position: sticky; top: 0; font-weight: 600; border-bottom: 2px solid var(--border-color);
        }
        td { padding: 14px; border-bottom: 1px solid var(--border-color); color: var(--text-main); }
        tr:hover td { background-color: #f8fafc; }

        .badge-tag { padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; display: inline-block; }
        .tag-door-open { background: #e6fffa; color: #319795; }
        .tag-door-close { background: #edf2f7; color: #4a5568; }
        .tag-light-on { background: #f0fff4; color: #38a169; }
        .tag-light-off { background: #fff5f5; color: #e53e3e; }
    </style>
</head>
<body>
<div class="container">
    <header>
        <div class="brand"><i class="fa-solid fa-house-signal"></i><h1>Trung Tâm Điều Khiển</h1></div>
        <div class="system-info">
            <div class="time-display"><i class="fa-regular fa-clock"></i> <span id="clock">00:00:00</span></div>
            <div class="status-badge" id="wsBadge"><div class="dot"></div><span id="wsStatus">Đang kết nối...</span></div>
        </div>
    </header>

    <div class="grid-cards">
        <div class="card" id="cardGas">
            <div class="card-header"><span class="card-title">Khí Gas (MQ-2)</span><i class="fa-solid fa-wind card-icon"></i></div>
            <div class="value-large" id="valGas">--</div><span class="unit-label">Chỉ số ADC</span>
        </div>
        <div class="card" id="cardVib">
            <div class="card-header"><span class="card-title">Cảm Biến Rung</span><i class="fa-solid fa-wave-square card-icon"></i></div>
            <div class="value-large" id="valVib">--</div><span class="unit-label">Cường độ</span>
        </div>
        <div class="card" id="cardWater">
            <div class="card-header"><span class="card-title">Ngập Nước</span><i class="fa-solid fa-droplet card-icon"></i></div>
            <div class="value-large" id="valWater" style="font-size: 28px; margin-top: 10px;">Bình Thường</div><span class="unit-label">Trạng thái phao</span>
        </div>
        <div class="card">
            <div class="card-header"><span class="card-title">Cửa Chính</span><i class="fa-solid fa-door-closed card-icon"></i></div>
            <div class="value-large" id="valDoor" style="font-size: 28px; margin-top: 10px;">Đã Đóng</div>
            <div class="btn-group">
                <button class="btn btn-primary" onclick="sendCommand('OPEN_DOOR')"><i class="fa-solid fa-unlock"></i> Mở Cửa</button>
                <button class="btn btn-outline" onclick="sendCommand('CLOSE_DOOR')"><i class="fa-solid fa-lock"></i> Đóng</button>
            </div>
        </div>
    </div>

    <div class="controls-grid">
        <div class="card">
            <div class="card-header"><span class="card-title">Biểu Đồ Đo Đạc</span><i class="fa-solid fa-chart-line card-icon"></i></div>
            <div class="chart-container"><canvas id="telemetryChart"></canvas></div>
        </div>
        <div class="card" style="display: flex; flex-direction: column; justify-content: space-between;">
            <div>
                <div class="card-header"><span class="card-title">Điều Khiển Đèn Phòng</span><i class="fa-regular fa-lightbulb card-icon"></i></div>
                <p style="font-size: 14px; color: var(--text-sub); line-height: 1.5; margin-top: 10px;">Bật/tắt hệ thống đèn chiếu sáng chính trong phòng qua rơ-le.</p>
            </div>
            <div class="btn-group" style="flex-direction: column; gap: 12px;">
                <button class="btn btn-primary" style="padding: 14px;" onclick="sendCommand('ROOM_LIGHT_ON')"><i class="fa-solid fa-lightbulb"></i> Bật Đèn</button>
                <button class="btn btn-danger" style="padding: 14px;" onclick="sendCommand('ROOM_LIGHT_OFF')"><i class="fa-regular fa-lightbulb"></i> Tắt Đèn</button>
            </div>
        </div>
    </div>

    <div class="card">
        <div class="card-header" style="margin-bottom: 0;"><span class="card-title"><i class="fa-solid fa-clock-rotate-left"></i> Lịch Sử Hoạt Động</span></div>
        <div class="filter-box" style="margin-top: 15px;">
            <label for="searchDate" style="font-size: 14px; font-weight: 500;">Chọn ngày:</label>
            <input type="date" id="searchDate">
            <button class="btn btn-primary" style="width: auto; padding: 8px 16px;" onclick="fetchLogsByDate()"><i class="fa-solid fa-magnifying-glass"></i> Tra cứu</button>
        </div>
        <div class="log-table-wrapper">
            <table>
                <thead>
                    <tr><th>Thời Gian</th><th>Sự Kiện</th><th>Khí Gas</th><th>Rung Chấn</th><th>Cảnh Báo Ngập</th><th>Trạng Thái Cửa</th></tr>
                </thead>
                <tbody id="logTableBody">
                    <tr><td colspan="6" style="text-align:center; color: var(--text-sub); padding: 30px;">Đang tải dữ liệu...</td></tr>
                </tbody>
            </table>
        </div>
    </div>
</div>

<script>
    setInterval(() => { document.getElementById('clock').innerText = new Date().toLocaleTimeString('vi-VN'); }, 1000);
    document.getElementById('searchDate').valueAsDate = new Date();

    Chart.defaults.color = '#718096';
    Chart.defaults.font.family = "'Inter', sans-serif";
    
    const ctx = document.getElementById('telemetryChart').getContext('2d');
    
    const telemetryChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { 
                    label: 'Khí Gas', data: [], 
                    borderColor: '#3182ce', backgroundColor: 'rgba(49, 130, 206, 0.1)', 
                    borderWidth: 2, pointRadius: 2, tension: 0.3, fill: true 
                },
                { 
                    label: 'Độ Rung', data: [], 
                    borderColor: '#dd6b20', backgroundColor: 'transparent', 
                    borderWidth: 2, pointRadius: 2, tension: 0.3 
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { position: 'top' } },
            scales: { 
                x: { grid: { display: false } }, 
                y: { grid: { color: '#edf2f7' } } 
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
            document.getElementById('wsStatus').innerText = "Đã kết nối";
        };
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const timeStr = new Date().toLocaleTimeString('vi-VN');

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
                    const elWater = document.getElementById('valWater');
                    if (data.water) {
                        elWater.innerText = "Cảnh Báo Ngập!";
                        elWater.style.color = "var(--danger)";
                        document.getElementById('cardWater').classList.add('hazard');
                    } else {
                        elWater.innerText = "Bình Thường";
                        elWater.style.color = "var(--text-main)";
                        document.getElementById('cardWater').classList.remove('hazard');
                    }
                }
                if (data.door !== undefined) {
                    const elDoor = document.getElementById('valDoor');
                    if (data.door) {
                        elDoor.innerText = "Đang Mở";
                        elDoor.style.color = "var(--primary)";
                    } else {
                        elDoor.innerText = "Đã Đóng";
                        elDoor.style.color = "var(--text-main)";
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
            document.getElementById('wsStatus').innerText = "Mất kết nối";
            setTimeout(connectWebSocket, 3000);
        };
    }

    async function fetchLogsByDate() {
        const selectedDate = document.getElementById('searchDate').value;
        if (!selectedDate) return alert("Vui lòng chọn ngày!");

        const tbody = document.getElementById('logTableBody');
        tbody.innerHTML = \`<tr><td colspan="6" style="text-align:center; padding: 30px;"><i class="fa-solid fa-circle-notch fa-spin"></i> Đang lấy dữ liệu...</td></tr>\`;

        try {
            const response = await fetch(\`/api/logs?date=\${selectedDate}\`);
            const logs = await response.json();
            tbody.innerHTML = '';

            if (!logs || logs.length === 0) {
                tbody.innerHTML = \`<tr><td colspan="6" style="text-align:center; color: var(--text-sub); padding: 30px;">Không có dữ liệu trong ngày \${selectedDate}</td></tr>\`;
                return;
            }

            logs.forEach(log => {
                const date = new Date(log.timestamp);
                const timeStr = \`\${date.getHours().toString().padStart(2,'0')}:\${date.getMinutes().toString().padStart(2,'0')}:\${date.getSeconds().toString().padStart(2,'0')}\`;
                
                let eventText = log.eventType;
                let doorTag = \`<span class='badge-tag tag-door-close'>\${log.door ? "Đang Mở" : "Đã Đóng"}</span>\`;

                if (log.eventType === 'DOOR_OPEN') { eventText = "Cửa tự động mở"; doorTag = \`<span class='badge-tag tag-door-open'>Đang Mở</span>\`; }
                else if (log.eventType === 'DOOR_CLOSE') { eventText = "Cửa đóng lại"; doorTag = \`<span class='badge-tag tag-door-close'>Đã Đóng</span>\`; }
                else if (log.eventType === 'ROOM_LIGHT_ON') { eventText = "Bật đèn phòng"; doorTag = \`<span class='badge-tag tag-light-on'>Bật</span>\`; }
                else if (log.eventType === 'ROOM_LIGHT_OFF') { eventText = "Tắt đèn phòng"; doorTag = \`<span class='badge-tag tag-light-off'>Tắt</span>\`; }
                else if (log.eventType === 'OPEN_DOOR') { eventText = "Lệnh mở cửa từ xa"; doorTag = \`<span class='badge-tag tag-door-open'>Lệnh Mở</span>\`; }
                else if (log.eventType === 'CLOSE_DOOR') { eventText = "Lệnh đóng cửa từ xa"; doorTag = \`<span class='badge-tag tag-door-close'>Lệnh Đóng</span>\`; }

                const row = document.createElement('tr');
                row.innerHTML = \`
                    <td>\${timeStr}</td>
                    <td style="font-weight: 500;">\${eventText}</td>
                    <td>\${log.gas !== undefined ? log.gas : '--'}</td>
                    <td>\${log.vib !== undefined ? log.vib : '--'}</td>
                    <td>\${log.water ? '<span style="color:var(--danger);font-weight:600;">Có nước</span>' : 'An toàn'}</td>
                    <td>\${doorTag}</td>
                \`;
                tbody.appendChild(row);
            });
        } catch (err) {
            tbody.innerHTML = \`<tr><td colspan="6" style="text-align:center; color: var(--danger); padding: 30px;">Lỗi kết nối đến máy chủ CSDL!</td></tr>\`;
        }
    }

    function sendCommand(cmd) { if (ws && ws.readyState === WebSocket.OPEN) ws.send(cmd); }

    connectWebSocket();
    fetchLogsByDate();
</script>
</body>
</html>
`;
