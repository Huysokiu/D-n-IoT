const http = require('http');
const WebSocket = require('ws');

// Lấy cổng tự động do Render cấp
const PORT = process.env.PORT || 3000;

// 1. TẠO HTTP SERVER (Chuyên phục vụ Trình duyệt Web)
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>IoT Server Status</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; margin-top: 60px; background: #121212; color: #fff; }
                .box { display: inline-block; padding: 30px 40px; border-radius: 12px; background: #1e1e1e; border: 2px solid #00E676; box-shadow: 0 4px 20px rgba(0,230,118,0.2); }
                h1 { color: #00E676; margin-bottom: 10px; }
                p { font-size: 16px; color: #ccc; }
                .badge { background: #00E676; color: #000; padding: 4px 8px; border-radius: 4px; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="box">
                <h1>🚀 SERVER IOT ĐANG HOẠT ĐỘNG!</h1>
                <p>Trạng thái: <span class="badge">ONLINE 24/7</span></p>
                <p>Dư án IoT : Nhóm 6</p>
                <p style="font-size: 13px; color: #888;">Sẵn sàng kết nối với ESP32 & App Android</p>
            </div>
        </body>
        </html>
    `);
});

// 2. KHỞI TẠO WEBSOCKET SERVER (Tách biệt hoàn toàn khỏi luồng HTTP)
const wss = new WebSocket.Server({ noServer: true });

// Lắng nghe yêu cầu nâng cấp kết nối từ HTTP sang WebSocket (WSS)
server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});

// Xử lý sự kiện truyền nhận dữ liệu WebSocket
wss.on('connection', (ws) => {
    console.log('[SERVER] 🟢 Có thiết bị mới kết nối WebSocket!');

    ws.on('message', (message) => {
        const dataString = message.toString();
        console.log('[ĐÃ NHẬN]:', dataString);

        // Chuyển tiếp tin nhắn sang các thiết bị còn lại (ESP32 <-> App)
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

// 3. LẮNG NGHE CỔNG PORT
server.listen(PORT, () => {
    console.log(`Server đang chạy tại cổng ${PORT}`);
});
