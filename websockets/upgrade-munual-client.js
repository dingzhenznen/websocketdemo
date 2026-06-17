const http = require('http');
const crypto = require('crypto');

// ============ 手动发送 Upgrade 请求的客户端（Node.js） ============

// 生成 Sec-WebSocket-Key (16字节随机数 base64 编码)
function generateWebSocketKey() {
  return crypto.randomBytes(16).toString('base64');
}

// 计算 Sec-WebSocket-Accept
function calculateAcceptKey(key) {
  return crypto
    .createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');
}

// 构造 WebSocket 帧（文本帧）
function createTextFrame(message) {
  const payload = Buffer.from(message, 'utf8');
  const payloadLength = payload.length;

  // 客户端发送的帧必须掩码
  const maskKey = crypto.randomBytes(4);

  let frame;
  if (payloadLength < 126) {
    frame = Buffer.allocUnsafe(2 + 4 + payloadLength);
    frame[0] = 0x81; // FIN=1, opcode=1 (text)
    frame[1] = 0x80 | payloadLength; // MASK=1, length
    maskKey.copy(frame, 2);
    // 掩码 payload
    for (let i = 0; i < payloadLength; i++) {
      frame[6 + i] = payload[i] ^ maskKey[i % 4];
    }
  } else {
    // 长消息处理省略...
  }

  return frame;
}

// 解析服务器返回的帧（服务器发送的帧不掩码）
function parseFrame(buffer) {
  if (buffer.length < 2) return null;

  const fin = (buffer[0] & 0x80) === 0x80;
  const opcode = buffer[0] & 0x0f;
  const masked = (buffer[1] & 0x80) === 0x80;
  let payloadLength = buffer[1] & 0x7f;

  let offset = 2;

  if (payloadLength === 126) {
    payloadLength = buffer.readUInt16BE(2);
    offset = 4;
  }

  if (masked) {
    // 服务器不应该发送掩码帧
    offset += 4;
  }

  const payload = buffer.slice(offset, offset + payloadLength);

  return {
    fin,
    opcode,
    payload: payload.toString('utf8'),
    length: offset + payloadLength
  };
}

// 手动发送 Upgrade 请求
function manualUpgradeRequest() {
  const key = generateWebSocketKey();

  console.log('========== 手动发送 WebSocket Upgrade 请求 ==========\n');
  console.log('1. 生成 Sec-WebSocket-Key:', key);

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/',
    method: 'GET',
    headers: {
      'Host': 'localhost:3000',
      'Connection': 'Upgrade',
      'Upgrade': 'websocket',
      'Sec-WebSocket-Key': key,
      'Sec-WebSocket-Version': '13',
      'Origin': 'http://localhost:3000'
    }
  };

  console.log('\n2. 发送 HTTP 请求:');
  console.log('   GET / HTTP/1.1');
  console.log('   Host: localhost:3000');
  console.log('   Connection: Upgrade');
  console.log('   Upgrade: websocket');
  console.log('   Sec-WebSocket-Key:', key);
  console.log('   Sec-WebSocket-Version: 13');

  const req = http.request(options);

  // 监听 upgrade 事件
  req.on('upgrade', (res, socket, upgradeHead) => {
    console.log('\n3. 收到服务器 101 响应！');
    console.log('   状态码:', res.statusCode);
    console.log('   状态消息:', res.statusMessage);
    console.log('   Sec-WebSocket-Accept:', res.headers['sec-websocket-accept']);

    // 验证 accept key
    const expectedAccept = calculateAcceptKey(key);
    if (res.headers['sec-websocket-accept'] === expectedAccept) {
      console.log('   ✓ Sec-WebSocket-Accept 验证通过');
    } else {
      console.log('   ✗ Sec-WebSocket-Accept 验证失败');
    }

    console.log('\n4. 协议升级成功！现在可以通过 socket 发送 WebSocket 帧\n');

    // 发送 WebSocket 消息
    const message = '你好，我是手动发送的 Upgrade 请求！';
    console.log('5. 发送消息:', message);
    const frame = createTextFrame(message);
    socket.write(frame);

    // 接收响应
    let buffer = Buffer.alloc(0);
    socket.on('data', (data) => {
      buffer = Buffer.concat([buffer, data]);
      const frame = parseFrame(buffer);
      if (frame) {
        console.log('6. 收到服务器回复:', frame.payload);
        console.log('\n7. 关闭连接...');
        socket.end();
      }
    });

    socket.on('close', () => {
      console.log('连接已关闭');
      process.exit(0);
    });
  });

  req.on('error', (err) => {
    console.error('请求错误:', err.message);
  });

  req.end();
}

// 先启动服务器，然后运行客户端
console.log('这个演示需要服务器运行在 localhost:3000');
console.log('请先运行: node upgrade-demo.js\n');

// 延迟 1 秒后连接
setTimeout(manualUpgradeRequest, 1000);
