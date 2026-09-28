const WebSocket = require('ws');

// Khởi tạo WebSocket Server ở cổng 3000
const wss = new WebSocket.Server({ port: 3000 });

console.log('=== WEBSOCKET SERVER ĐANG CHẠY TẠI CỔNG 3000 ===');

wss.on('connection', (ws) => {
    console.log('[SERVER] Có thiết bị mới kết nối!');

    // Nhận dữ liệu từ ESP32 hoặc App Android
    ws.on('message', (message) => {
        const dataString = message.toString();
        console.log('[ĐÃ NHẬN]:', dataString);

        // Phát lại dữ liệu cho thiết bị còn lại
        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(dataString);
            }
        });
    });

    ws.on('close', () => {
        console.log('[SERVER] Một thiết bị đã ngắt kết nối!');
    });
});