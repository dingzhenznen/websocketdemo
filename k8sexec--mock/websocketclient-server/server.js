const express = require('express');
const { WebSocketServer } = require('ws');
const { exec } = require('child_process');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// HTTP 服务器
const server = app.listen(PORT, () => {
  console.log(`HTTP server listening on http://localhost:${PORT}`);
});

// WebSocket 服务器
const wss = new WebSocketServer({ server });

function sendJson(ws, data) {
  if (ws.readyState === 1) { // WebSocket.OPEN
    ws.send(JSON.stringify(data));
  }
}

wss.on('connection', (ws, req) => {
  console.log(`Client connected from ${req.socket.remoteAddress}`);

  sendJson(ws, {
    type: 'connected',
    message: 'WebSocket 已连接，发送命令格式: {"type":"exec","command":"ls -la"}'
  });

  ws.on('message', (data) => {
    let message;
    try {
      message = JSON.parse(data.toString());
    } catch (e) {
      sendJson(ws, { type: 'error', message: '无效的 JSON 格式' });
      return;
    }

    if (message.type === 'exec' && message.command) {
      const command = message.command;
      console.log(`执行命令: ${command}`);

      sendJson(ws, { type: 'status', message: `开始执行: ${command}` });

      // 使用 exec 执行命令
      const child = exec(command, {
        timeout: 30000, // 30秒超时
        maxBuffer: 1024 * 1024 // 1MB 缓冲区
      });

      // 实时发送 stdout
      child.stdout.on('data', (data) => {
        sendJson(ws, {
          type: 'stdout',
          data: data.toString()
        });
      });

      // 实时发送 stderr
      child.stderr.on('data', (data) => {
        sendJson(ws, {
          type: 'stderr',
          data: data.toString()
        });
      });

      // 命令完成
      child.on('close', (code) => {
        sendJson(ws, {
          type: 'completed',
          code: code,
          message: `命令执行完成，退出码: ${code}`
        });
      });

      // 错误处理
      child.on('error', (error) => {
        sendJson(ws, {
          type: 'error',
          message: `执行错误: ${error.message}`
        });
      });

    } else {
      sendJson(ws, {
        type: 'error',
        message: '未知的消息类型，请使用 {"type":"exec","command":"你的命令"}'
      });
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error.message);
  });
});

console.log('WebSocket server will be available on ws://localhost:' + PORT);
