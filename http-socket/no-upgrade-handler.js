const http = require('http');
const crypto = require('crypto');

// ============ 测试：不监听 upgrade 事件 ============

const server = http.createServer((req, res) => {
  // 检查是否是 WebSocket upgrade 请求
  const isUpgrade = req.headers.upgrade === 'websocket';

  if (isUpgrade) {
    console.log('\\n========== 收到 WebSocket Upgrade 请求 ==========');
    console.log('但是服务器没有监听 upgrade 事件！');
    console.log('请求头:', req.headers);

    // 不处理 upgrade，返回普通 HTTP 响应
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('This server does not support WebSocket\\n');
    return;
  }

  // 普通 HTTP 请求
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Test No Upgrade Handler</title>
</head>
<body>
  <h1>测试：服务器不监听 upgrade 事件</h1>
  <pre id="log"></pre>

  <script>
    const log = document.getElementById('log');
    function addLog(msg) {
      log.textContent += msg + '\\n';
    }

    addLog('尝试连接 WebSocket...');

    const ws = new WebSocket('ws://localhost:3001');

    ws.onopen = () => {
      addLog('✓ 连接成功！');
      ws.send('hello');
    };

    ws.onmessage = (e) => {
      addLog('收到: ' + e.data);
    };

    ws.onerror = (err) => {
      addLog('✗ 错误: ' + err.type);
    };

    ws.onclose = (e) => {
      addLog('✗ 连接关闭');
      addLog('  code: ' + e.code);
      addLog('  reason: ' + e.reason);
      addLog('  wasClean: ' + e.wasClean);
    };
  </script>
</body>
</html>
  `);
});

// 注意：这里没有 server.on('upgrade', ...)
// 服务器不处理 WebSocket upgrade 请求

server.listen(3001, () => {
  console.log('服务器运行在 http://localhost:3001');
  console.log('这个服务器不监听 upgrade 事件！');
  console.log('尝试连接 WebSocket 会失败。\\n');
});
