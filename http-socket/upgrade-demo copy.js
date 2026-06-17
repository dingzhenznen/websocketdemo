const http = require('http');
const crypto = require('crypto');

// ============ 服务器端 ============
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>WebSocket Upgrade Demo</title>
</head>
<body>
  <h1>方式一：使用浏览器 WebSocket API（自动发送 upgrade）</h1>
  <pre id="auto-log"></pre>

  <h1>方式二：手动发送 HTTP upgrade 请求</h1>
  <button onclick="manualUpgrade()">手动发送 Upgrade 请求</button>
  <pre id="manual-log"></pre>

  <script>
    // ========== 方式一：浏览器自动处理 ==========
    const autoLog = document.getElementById('auto-log');

    function logAuto(msg) {
      autoLog.textContent += msg + '\\n';
    }

    // 创建 WebSocket 时，浏览器自动发送 upgrade 请求
    const ws = new WebSocket('ws://localhost:3000');

    logAuto('1. new WebSocket(\"ws://localhost:3000\")');
    logAuto('2. 浏览器自动发送 HTTP 请求，带以下头：');
    logAuto('   Connection: Upgrade');
    logAuto('   Upgrade: websocket');
    logAuto('   Sec-WebSocket-Key: <随机生成的 base64 字符串>');
    logAuto('   Sec-WebSocket-Version: 13');

    ws.onopen = () => {
      logAuto('3. 收到服务器 101 响应，握手成功！');
      logAuto('4. 连接状态: OPEN');
      ws.send('你好服务器！');
    };

    ws.onmessage = (e) => {
      logAuto('5. 收到消息: ' + e.data);
    };

    // ========== 方式二：手动发送 upgrade 请求 ==========
    const manualLog = document.getElementById('manual-log');

    function logManual(msg) {
      manualLog.textContent += msg + '\\n';
    }

    async function manualUpgrade() {
      logManual('\\n=== 手动发送 Upgrade 请求 ===');

      // 生成 Sec-WebSocket-Key (16字节随机数 base64 编码)
      const key = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
      logManual('生成的 Sec-WebSocket-Key: ' + key);

      // 使用 fetch 无法真正 upgrade，因为浏览器限制
      // 这里展示请求头，实际 upgrade 需要通过其他方式
      logManual('\\n手动构造的 HTTP 请求：');
      logManual('GET / HTTP/1.1');
      logManual('Host: localhost:3000');
      logManual('Connection: Upgrade');
      logManual('Upgrade: websocket');
      logManual('Sec-WebSocket-Key: ' + key);
      logManual('Sec-WebSocket-Version: 13');
      logManual('\\n注意：浏览器中 fetch/xhr 无法直接 upgrade，');
      logManual('      必须使用 WebSocket API');

      // 实际还是使用 WebSocket API
      logManual('\\n现在使用 WebSocket API 连接...');
      const ws2 = new WebSocket('ws://localhost:3000');
      ws2.onopen = () => {
        logManual('手动连接成功！');
        ws2.send('手动发送的消息');
      };
      ws2.onmessage = (e) => {
        logManual('收到回复: ' + e.data);
      };
    }
  </script>
</body>
</html>
  `);
});

// 处理 WebSocket upgrade
server.on('upgrade', (req, socket, head) => {
  console.log('\\n========== 收到 Upgrade 请求 ==========');
  console.log('请求方法:', req.method);
  console.log('请求路径:', req.url);
  console.log('请求头:');
  console.log('  Connection:', req.headers.connection);
  console.log('  Upgrade:', req.headers.upgrade);
  console.log('  Sec-WebSocket-Key:', req.headers['sec-websocket-key']);
  console.log('  Sec-WebSocket-Version:', req.headers['sec-websocket-version']);

  // 计算 accept key
  const key = req.headers['sec-websocket-key'];
  const acceptKey = crypto
    .createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');

  // 发送 101 响应
  const response = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey}`,
    '',
    ''
  ].join('\\r\\n');

  socket.write(response);
  console.log('\\n已发送 101 Switching Protocols 响应');
  console.log('协议升级完成，现在是 WebSocket 连接！');

  // 处理 WebSocket 数据帧
  socket.on('data', (data) => {
    // 简单解析文本帧
    const masked = (data[1] & 0x80) === 0x80;
    const payloadLength = data[1] & 0x7f;
    let offset = 2;

    if (masked) {
      const maskKey = data.slice(offset, offset + 4);
      offset += 4;
      let payload = data.slice(offset, offset + payloadLength);
      for (let i = 0; i < payload.length; i++) {
        payload[i] ^= maskKey[i % 4];
      }
      const message = payload.toString('utf8');
      console.log('\\n收到消息:', message);

      // 发送回复
      const reply = Buffer.from('服务器收到: ' + message, 'utf8');
      const frame = Buffer.allocUnsafe(2 + reply.length);
      frame[0] = 0x81; // FIN=1, text frame
      frame[1] = reply.length;
      reply.copy(frame, 2);
      socket.write(frame);
    }
  });

  socket.on('close', () => {
    console.log('\\n客户端断开连接');
  });
});

server.listen(3000, () => {
  console.log('服务器运行在 http://localhost:3000');
  console.log('打开浏览器访问，查看 upgrade 请求详情');
});
