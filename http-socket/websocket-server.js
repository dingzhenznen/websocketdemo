const http = require('http');
const crypto = require('crypto');

// WebSocket 握手需要的 GUID
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

// 简单的 WebSocket 帧解析和构造（文本帧）
function parseWebSocketFrame(buffer) {
  if (buffer.length < 2) return null;

  const fin = (buffer[0] & 0x80) === 0x80;
  const opcode = buffer[0] & 0x0f;
  const masked = (buffer[1] & 0x80) === 0x80;
  let payloadLength = buffer[1] & 0x7f;

  let offset = 2;

  if (payloadLength === 126) {
    if (buffer.length < 4) return null;
    payloadLength = buffer.readUInt16BE(2);
    offset = 4;
  } else if (payloadLength === 127) {
    if (buffer.length < 10) return null;
    payloadLength = buffer.readUInt32BE(6); // 简化处理，只读低32位
    offset = 10;
  }

  let maskKey;
  if (masked) {
    if (buffer.length < offset + 4) return null;
    maskKey = buffer.slice(offset, offset + 4);
    offset += 4;
  }

  if (buffer.length < offset + payloadLength) return null;

  let payload = buffer.slice(offset, offset + payloadLength);

  // 解码掩码数据
  if (masked && maskKey) {
    for (let i = 0; i < payload.length; i++) {
      payload[i] ^= maskKey[i % 4];
    }
  }

  return {
    fin,
    opcode,
    payload: payload.toString('utf8'),
    length: offset + payloadLength
  };
}

function createWebSocketFrame(message) {
  const payload = Buffer.from(message, 'utf8');
  const payloadLength = payload.length;

  let frame;
  if (payloadLength < 126) {
    frame = Buffer.allocUnsafe(2 + payloadLength);
    frame[0] = 0x81; // FIN=1, opcode=1 (text)
    frame[1] = payloadLength;
    payload.copy(frame, 2);
  } else if (payloadLength < 65536) {
    frame = Buffer.allocUnsafe(4 + payloadLength);
    frame[0] = 0x81;
    frame[1] = 126;
    frame.writeUInt16BE(payloadLength, 2);
    payload.copy(frame, 4);
  } else {
    frame = Buffer.allocUnsafe(10 + payloadLength);
    frame[0] = 0x81;
    frame[1] = 127;
    frame.writeUInt32BE(0, 2);
    frame.writeUInt32BE(payloadLength, 6);
    payload.copy(frame, 10);
  }

  return frame;
}

// 创建 HTTP 服务器
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>WebSocket Demo</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
    #messages { border: 1px solid #ccc; height: 300px; overflow-y: auto; padding: 10px; margin-bottom: 10px; }
    .message { margin: 5px 0; padding: 5px; background: #f0f0f0; border-radius: 3px; }
    .sent { background: #d4edda; text-align: right; }
    .received { background: #d1ecf1; }
    .system { background: #fff3cd; font-style: italic; }
    input { width: 70%; padding: 10px; }
    button { padding: 10px 20px; }
  </style>
</head>
<body>
  <h1>WebSocket Demo</h1>
  <div id="messages"></div>
  <input type="text" id="input" placeholder="输入消息..." />
  <button onclick="send()">发送</button>
  <button onclick="connect()">连接</button>
  <button onclick="disconnect()">断开</button>

  <script>
    let ws = null;
    const messagesDiv = document.getElementById('messages');
    const input = document.getElementById('input');

    function addMessage(text, type) {
      const div = document.createElement('div');
      div.className = 'message ' + type;
      div.textContent = text;
      messagesDiv.appendChild(div);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    function connect() {
      if (ws) return;
      ws = new WebSocket('ws://localhost:8080');

      ws.onopen = () => {
        addMessage('已连接到服务器', 'system');
      };

      ws.onmessage = (event) => {
        addMessage('收到: ' + event.data, 'received');
      };

      ws.onclose = () => {
        addMessage('连接已断开', 'system');
        ws = null;
      };

      ws.onerror = (err) => {
        addMessage('错误: ' + err, 'system');
      };
    }

    function send() {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        addMessage('未连接到服务器', 'system');
        return;
      }
      const text = input.value;
      if (!text) return;
      ws.send(text);
      addMessage('发送: ' + text, 'sent');
      input.value = '';
    }

    function disconnect() {
      if (ws) {
        ws.close();
      }
    }

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') send();
    });

    // 自动连接
    connect();
  </script>
</body>
</html>
  `);
});

// 存储所有连接的客户端
const clients = new Set();

// 处理 WebSocket 升级
server.on('upgrade', (req, socket, head) => {
  console.log('收到升级请求');

  // 获取 Sec-WebSocket-Key
  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    return;
  }

  // 计算 Sec-WebSocket-Accept
  const acceptKey = crypto
    .createHash('sha1')
    .update(key + WS_GUID)
    .digest('base64');

  // 发送握手响应
  const response = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey}`,
    '',
    ''
  ].join('\r\n');

  socket.write(response);
  console.log('WebSocket 握手成功');

  // 添加到客户端列表
  clients.add(socket);
  console.log(`当前连接数: ${clients.size}`);

  // 发送欢迎消息
  socket.write(createWebSocketFrame('欢迎来到 WebSocket 服务器！'));

  // 广播新用户加入
  broadcast('新用户加入了聊天室', socket);

  // 处理数据
  let buffer = Buffer.alloc(0);

  socket.on('data', (data) => {
    buffer = Buffer.concat([buffer, data]);

    while (buffer.length > 0) {
      const frame = parseWebSocketFrame(buffer);
      if (!frame) break;

      buffer = buffer.slice(frame.length);

      // 处理关闭帧
      if (frame.opcode === 0x08) {
        console.log('收到关闭帧');
        socket.end();
        return;
      }

      // 处理 ping 帧
      if (frame.opcode === 0x09) {
        // 回复 pong
        const pongFrame = Buffer.from([0x8a, 0x00]);
        socket.write(pongFrame);
        continue;
      }

      // 处理文本帧
      if (frame.opcode === 0x01 || frame.opcode === 0x00) {
        console.log('收到消息:', frame.payload);

        // 回声回复
        socket.write(createWebSocketFrame(`服务器回声: ${frame.payload}`));

        // 广播给所有其他客户端
        broadcast(`用户说: ${frame.payload}`, socket);
      }
    }
  });

  socket.on('close', () => {
    console.log('客户端断开连接');
    clients.delete(socket);
    broadcast('有用户离开了聊天室', socket);
    console.log(`当前连接数: ${clients.size}`);
  });

  socket.on('error', (err) => {
    console.error('Socket 错误:', err.message);
    clients.delete(socket);
  });
});

// 广播消息给所有客户端（除了发送者）
function broadcast(message, excludeSocket) {
  const frame = createWebSocketFrame(message);
  for (const client of clients) {
    if (client !== excludeSocket && !client.destroyed) {
      client.write(frame);
    }
  }
}

server.listen(8080, () => {
  console.log('服务器运行在 http://localhost:8080');
  console.log('在浏览器中打开以上地址即可测试 WebSocket');
});
