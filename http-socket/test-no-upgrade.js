const http = require('http');
const crypto = require('crypto');

// 测试：不监听 upgrade 时，客户端会发生什么

const server = http.createServer((req, res) => {
  console.log('\n========== 收到 HTTP 请求 ==========');
  console.log('URL:', req.url);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));

  // 即使是 upgrade 请求，也当作普通 HTTP 处理
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello from HTTP server\n');
});

// 不监听 upgrade 事件

server.listen(3002, () => {
  console.log('服务器运行在 http://localhost:3002');
  console.log('注意：这个服务器没有监听 upgrade 事件\n');

  // 3秒后作为客户端测试连接
  setTimeout(testWebSocketConnection, 3000);
});

function testWebSocketConnection() {
  console.log('\n========== 客户端测试 ==========');
  console.log('尝试发送 WebSocket upgrade 请求...\n');

  const key = crypto.randomBytes(16).toString('base64');

  const options = {
    hostname: 'localhost',
    port: 3002,
    path: '/',
    method: 'GET',
    headers: {
      'Host': 'localhost:3002',
      'Connection': 'Upgrade',
      'Upgrade': 'websocket',
      'Sec-WebSocket-Key': key,
      'Sec-WebSocket-Version': '13'
    }
  };

  const req = http.request(options);

  // 监听 upgrade 事件 - 如果服务器不处理，这个事件不会触发
  req.on('upgrade', (res, socket, head) => {
    console.log('✓ 收到 upgrade 响应！');
    console.log('状态码:', res.statusCode);
    socket.end();
    server.close();
  });

  // 监听响应 - 如果服务器不处理 upgrade，会收到普通 HTTP 响应
  req.on('response', (res) => {
    console.log('✗ 收到普通 HTTP 响应（不是 upgrade）');
    console.log('状态码:', res.statusCode);
    console.log('说明：服务器没有处理 upgrade 请求');

    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('响应体:', data);
      console.log('\n结论：不监听 upgrade 事件，WebSocket 连接会失败！');
      server.close();
    });
  });

  req.on('error', (err) => {
    console.error('请求错误:', err.message);
    server.close();
  });

  req.end();
}
