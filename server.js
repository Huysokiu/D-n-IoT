const http = require('http');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;

// 1. HTTP SERVER: TRẢ VỀ GIAO DIỆN WEB GIÁM SÁT REALTIME
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Giám Sát IoT Realtime</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; margin-top: 40px; background: #121212; color: #fff; }
                .card { display: inline-block; padding: 30px 40px; border-radius: 16px; background: #1e1e1e; min-width: 340px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); border: 2px solid #333; }
                .status-box { font-size: 20px; font-weight: bold; margin: 20px 0; padding: 15px; border-radius: 10px; transition: all 0.3s ease; }
                .safe { background-color: #2e7d32; color: #fff; }
                .warning { background-color: #f57f17; color: #fff; }
                .danger { background-color: #c62828; color: #fff; }
                .info-row { font-size: 16px; margin: 14px 0; color: #ccc; text-align: left; }
                .value { font-weight: bold; color: #00E676; float: right; }
                .badge { background: #00E676; color: #000; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>🚀 HỆ THỐNG GIÁM SÁT AN TOÀN</h2>
                <p style="font-size:12px; color:#888;">Kết nối Server: <span id="wsStatus" class="badge">ĐANG ĐỜI...</span></p>
                
                <div id="statusBox" class="status-box safe">TRẠNG THÁI: AN TOÀN</div>

                <div class="info-row">Mức độ rung (ADC): <span id="vibVal" class="value">0</span></div>
                <div class="info-row">Cảnh báo phao nước: <span id="waterVal" class="value">Bình thường</span></div>
            </div>

            <script>
                // Tự động kết nối tới WebSocket Server của Render
                const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
                const ws = new WebSocket(protocol + '//' + location.host);

                const wsStatus = document.getElementById('wsStatus');
                const statusBox = document.getElementById('statusBox');
                const vibVal = document.getElementById('vibVal');
                const waterVal = document.getElementById('waterVal');

                ws.onopen = () => {
                    wsStatus.innerText = "ĐÃ KẾT NỐI";
                    wsStatus.style.background = "#00E676";
                };

                // Lắng nghe dữ liệu gửi từ ESP32 sang
                ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        
                        // Cập nhật Mức độ rung
                        if (data.vib_value !== undefined) {
                            vibVal.innerText = data.vib_value;
                        }

                        // Cập nhật Cảnh báo phao nước
                        if (data.water_high !== undefined) {
                            if (data.water_high) {
                                waterVal.innerText = "NGUY HIỂM (DÂNG CAO)";
                                waterVal.style.color = "#ff5252";
                            } else {
                                waterVal.innerText = "Bình thường";
                                waterVal.style.color = "#00E676";
                            }
                        }

                        // Cập nhật Màu sắc hiển thị theo State
                        if (data.state === 0) {
                            statusBox.innerText = "TRẠNG THÁI: AN TOÀN";
                            statusBox.className = "status-box safe";
                        } else if (data.state === 1) {
                            statusBox.innerText = "CẢNH BÁO: RUNG CHẤN!";
                            statusBox.className = "status-box warning";
                        } else if (data.state === 2) {
                            statusBox.innerText = "NGUY HIỂM: NƯỚC DÂNG CAO!";
                            statusBox.className = "status-box danger";
                        }
                    } catch (e) {
                        console.log("Nhận tin nhắn:", event.data);
                    }
                };

                ws.onclose = () => {
                    wsStatus.innerText = "MẤT KẾT NỐI";
                    wsStatus.style.background = "#ff5252";
                };
            </script>
        </body>
        </html>
    `);
});

// 2. WEBSOCKET SERVER: TRUNG CHUYỂN DỮ LIỆU
const wss = new WebSocket.Server({ noServer: true });

server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});

wss.on('connection', (ws) => {
    console.log('[SERVER] 🟢 Có thiết bị/Web mới kết nối WebSocket!');

    ws.on('message', (message) => {
        const dataString = message.toString();
        console.log('[ĐÃ NHẬN]:', dataString);

        // Phát dữ liệu sang cho cả App Android lẫn Trình duyệt Web
        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(dataString);
            }
        });
    });

    ws.on('close', () => {
        console.log('[SERVER] 🔴 Một thiết bị đã ngắt kết nối!');
    });
});

server.listen(PORT, () => {
    console.log(`Server đang chạy tại cổng ${PORT}`);
});
