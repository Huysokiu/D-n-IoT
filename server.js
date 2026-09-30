const http = require('http');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;

// 1. HTTP SERVER: PHỤC VỤ GIAO DIỆN WEB NỀN TRẮNG HIỆN ĐẠI
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Hệ Thống Giám Sát IoT An Toàn Nhà</title>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
                body { background-color: #f8fafc; color: #0f172a; padding: 24px 16px; min-height: 100vh; display: flex; justify-content: center; }
                .container { max-width: 600px; width: 100%; }
                
                /* HEADER */
                .header { background: #ffffff; padding: 20px 24px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
                .header h1 { font-size: 18px; font-weight: 700; color: #0f172a; }
                .badge { padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }
                .badge-connected { background-color: #dcfce7; color: #15803d; }
                .badge-disconnected { background-color: #fee2e2; color: #b91c1c; }
                .dot { width: 8px; height: 8px; border-radius: 50%; background-color: currentColor; }

                /* BANNER TRẠNG THÁI TỔNG QUAN */
                .status-card { padding: 20px; border-radius: 16px; margin-bottom: 20px; text-align: center; font-weight: 700; font-size: 18px; transition: all 0.3s ease; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); }
                .status-safe { background-color: #ecfdf5; border: 1.5px solid #a7f3d0; color: #047857; }
                .status-warning { background-color: #fffbeb; border: 1.5px solid #fde68a; color: #b45309; }
                .status-danger { background-color: #fef2f2; border: 1.5px solid #fecaca; color: #b91c1c; }

                /* SECTION TITLES */
                .section-title { font-size: 13px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin: 24px 0 12px 4px; }

                /* GRID CẢM BIẾN */
                .sensor-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
                .card { background: #ffffff; padding: 18px 20px; border-radius: 14px; border: 1px solid #e2e8f0; box-shadow: 0 2px 4px rgba(0,0,0,0.02); display: flex; justify-content: space-between; align-items: center; }
                .card-info { display: flex; flex-direction: column; gap: 4px; }
                .card-label { font-size: 13px; color: #64748b; font-weight: 500; }
                .card-value { font-size: 15px; font-weight: 600; color: #1e293b; }
                .icon { font-size: 22px; }

                /* ĐIỀU KHIỂN */
                .control-list { display: flex; flex-direction: column; gap: 12px; }
                .btn-action { width: 100%; padding: 12px 20px; border-radius: 10px; border: none; font-weight: 600; font-size: 14px; cursor: pointer; transition: all 0.2s; display: flex; justify-content: center; align-items: center; gap: 8px; }
                .btn-primary { background-color: #2563eb; color: #ffffff; }
                .btn-primary:hover { background-color: #1d4ed8; }
                .btn-danger { background-color: #ef4444; color: #ffffff; }
                .btn-danger:hover { background-color: #dc2626; }
                .btn-secondary { background-color: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }
                .btn-secondary:hover { background-color: #e2e8f0; }

                .active-hazard { color: #dc2626 !important; font-weight: 700; }
            </style>
        </head>
        <body>
            <div class="container">
                <!-- HEADER -->
                <div class="header">
                    <h1>Hệ Thống IoT An Toàn</h1>
                    <div id="connBadge" class="badge badge-disconnected">
                        <span class="dot"></span><span id="connText">Đang kết nối...</span>
                    </div>
                </div>

                <!-- BANNER TRẠNG THÁI -->
                <div id="statusBanner" class="status-card status-safe">
                    TRẠNG THÁI: AN TOÀN
                </div>

                <!-- DỮ LIỆU CẢM BIẾN REALTIME -->
                <div class="section-title">Thông số cảm biến theo thời gian thực</div>
                <div class="sensor-grid">
                    <div class="card">
                        <div class="card-info">
                            <span class="card-label">Khí Gas (MQ-2)</span>
                            <span id="valGas" class="card-value">0 (An toàn)</span>
                        </div>
                        <span class="icon">🔥</span>
                    </div>
                    <div class="card">
                        <div class="card-info">
                            <span class="card-label">Ngập nước</span>
                            <span id="valWater" class="card-value">Bình thường</span>
                        </div>
                        <span class="icon">💧</span>
                    </div>
                    <div class="card">
                        <div class="card-info">
                            <span class="card-label">Rung chấn / Động đất</span>
                            <span id="valVib" class="card-value">Không</span>
                        </div>
                        <span class="icon">📳</span>
                    </div>
                    <div class="card">
                        <div class="card-info">
                            <span class="card-label">Đột nhập (PIR)</span>
                            <span id="valPir" class="card-value">Không phát hiện</span>
                        </div>
                        <span class="icon">🚨</span>
                    </div>
                </div>

                <!-- BẢNG ĐIỀU KHIỂN TỪ XA -->
                <div class="section-title">Điều khiển thiết bị từ xa</div>
                <div class="control-list">
                    <div class="card">
                        <div class="card-info">
                            <span class="card-label">Đèn Tầng 1 (Relay 1)</span>
                            <span id="lightStateText" class="card-value">Đang tắt</span>
                        </div>
                        <button id="btnLight" class="btn-action btn-primary" onclick="toggleLight()">BẬT ĐÈN</button>
                    </div>

                    <div class="card">
                        <div class="card-info">
                            <span class="card-label">Cửa Thoát Hiểm (Servo)</span>
                            <span id="doorStateText" class="card-value">Đang đóng</span>
                        </div>
                        <button id="btnDoor" class="btn-action btn-secondary" onclick="toggleDoor()">MỞ CỬA</button>
                    </div>
                </div>
            </div>

            <script>
                const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
                const ws = new WebSocket(protocol + '//' + location.host);

                let isLightOn = false;
                let isDoorOpen = false;

                const connBadge = document.getElementById('connBadge');
                const connText = document.getElementById('connText');
                const statusBanner = document.getElementById('statusBanner');

                const valGas = document.getElementById('valGas');
                const valWater = document.getElementById('valWater');
                const valVib = document.getElementById('valVib');
                const valPir = document.getElementById('valPir');

                const btnLight = document.getElementById('btnLight');
                const btnDoor = document.getElementById('btnDoor');
                const lightStateText = document.getElementById('lightStateText');
                const doorStateText = document.getElementById('doorStateText');

                ws.onopen = () => {
                    connBadge.className = "badge badge-connected";
                    connText.innerText = "Đã kết nối Server";
                };

                ws.onmessage = (event) => {
                    try {
                        const message = event.data;

                        // Đồng bộ trạng thái điều khiển từ App/Serial
                        if (message === "LIGHT_ON") updateLightUI(true);
                        else if (message === "LIGHT_OFF") updateLightUI(false);
                        else if (message === "DOOR_OPEN") updateDoorUI(true);
                        else if (message === "DOOR_CLOSE") updateDoorUI(false);

                        // Cập nhật dữ liệu JSON từ ESP32
                        const data = JSON.parse(message);

                        if (data.gas !== undefined) {
                            valGas.innerText = data.gas + (data.gas_active ? " ⚠️ CẢNH BÁO!" : " (An toàn)");
                            valGas.className = data.gas_active ? "card-value active-hazard" : "card-value";
                        }

                        if (data.water_active !== undefined) {
                            valWater.innerText = data.water_active ? "⚠️ NGẬP NƯỚC (Ngắt điện)" : "Bình thường";
                            valWater.className = data.water_active ? "card-value active-hazard" : "card-value";
                        }

                        if (data.vib_active !== undefined) {
                            valVib.innerText = data.vib_active ? "⚠️ CÓ RUNG CHẤN!" : "Không";
                            valVib.className = data.vib_active ? "card-value active-hazard" : "card-value";
                        }

                        if (data.pir_active !== undefined) {
                            valPir.innerText = data.pir_active ? "⚠️ CÓ ĐỘT NHẬP!" : "Không phát hiện";
                            valPir.className = data.pir_active ? "card-value active-hazard" : "card-value";
                        }

                        // Cập nhật màu Banner tổng quan
                        if (data.gas_active || data.water_active || data.pir_active) {
                            statusBanner.innerText = "🚨 NGUY HIỂM! PHÁT HIỆN SỰ CỐ";
                            statusBanner.className = "status-card status-danger";
                        } else if (data.vib_active) {
                            statusBanner.innerText = "⚠️ CẢNH BÁO RUNG CHẤN";
                            statusBanner.className = "status-card status-warning";
                        } else {
                            statusBanner.innerText = "TRẠNG THÁI: AN TOÀN";
                            statusBanner.className = "status-card status-safe";
                        }

                    } catch (e) {
                        console.log("Truyền nhận lệnh:", event.data);
                    }
                };

                ws.onclose = () => {
                    connBadge.className = "badge badge-disconnected";
                    connText.innerText = "Ngắt kết nối";
                };

                // Hàm Bật/Tắt Đèn Tầng 1
                function toggleLight() {
                    isLightOn = !isLightOn;
                    const cmd = isLightOn ? "LIGHT_ON" : "LIGHT_OFF";
                    ws.send(cmd);
                    updateLightUI(isLightOn);
                }

                function updateLightUI(on) {
                    isLightOn = on;
                    lightStateText.innerText = on ? "Đang bật" : "Đang tắt";
                    btnLight.innerText = on ? "TẮT ĐÈN" : "BẬT ĐÈN";
                    btnLight.className = on ? "btn-action btn-danger" : "btn-action btn-primary";
                }

                // Hàm Mở/Đóng Cửa Thoát Hiểm
                function toggleDoor() {
                    isDoorOpen = !isDoorOpen;
                    const cmd = isDoorOpen ? "DOOR_OPEN" : "DOOR_CLOSE";
                    ws.send(cmd);
                    updateDoorUI(isDoorOpen);
                }

                function updateDoorUI(open) {
                    isDoorOpen = open;
                    doorStateText.innerText = open ? "Đang mở" : "Đang đóng";
                    btnDoor.innerText = open ? "ĐÓNG CỬA" : "MỞ CỬA";
                    btnDoor.className = open ? "btn-action btn-danger" : "btn-action btn-secondary";
                }
            </script>
        </body>
        </html>
    `);
});

// 2. TÍCH HỢP WEBSOCKET SERVER VÀO ĐẦU MỐI HTTP
const wss = new WebSocket.Server({ noServer: true });

server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});

wss.on('connection', (ws) => {
    console.log('[SERVER] 🟢 Có thiết bị/Trình duyệt mới kết nối!');

    ws.on('message', (message) => {
        const dataString = message.toString();
        console.log('[ĐÃ NHẬN]:', dataString);

        // Chuyển tiếp tin nhắn/lệnh cho tất cả các bên kết nối (ESP32, Web Dashboard, App Android)
        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(dataString);
            }
        });
    });

    ws.on('close', () => {
        console.log('[SERVER] 🔴 Một kết nối đã ngắt!');
    });
});

server.listen(PORT, () => {
    console.log(`Server đang lắng nghe tại cổng ${PORT}`);
});
