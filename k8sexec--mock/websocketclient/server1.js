const express = require('express');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 3001;

// 目标 WebSocket 服务器地址（刚刚创建的服务）
const TARGET_WS_URL = process.env.TARGET_WS_URL || 'ws://localhost:3000';

app.use(express.json());

/**
 * POST /api/exec
 * 执行命令的 HTTP 接口
 * 请求体: { "command": "ls -la" }
 * 返回: 命令执行的完整输出
 */
app.post('/api/exec', async (req, res) => {
  const { command } = req.body;

  if (!command) {
    return res.status(400).json({
      success: false,
      error: '缺少 command 参数'
    });
  }

  console.log(`[HTTP] 收到执行请求: ${command}`);

  try {
    const result = await executeCommandViaWebSocket(command);
    res.json({
      success: true,
      command: command,
      ...result
    });
  } catch (error) {
    console.error('[HTTP] 执行失败:', error.message);
    res.status(500).json({
      success: false,
      command: command,
      error: error.message
    });
  }
});

/**
 * GET /api/exec?command=ls%20-la
 * 通过 GET 请求执行命令
 */
app.get('/api/exec', async (req, res) => {
  const { command } = req.query;

  if (!command) {
    return res.status(400).json({
      success: false,
      error: '缺少 command 查询参数'
    });
  }

  console.log(`[HTTP GET] 收到执行请求: ${command}`);

  try {
    const result = await executeCommandViaWebSocket(command);
    res.json({
      success: true,
      command: command,
      ...result
    });
  } catch (error) {
    console.error('[HTTP GET] 执行失败:', error.message);
    res.status(500).json({
      success: false,
      command: command,
      error: error.message
    });
  }
});

/**
 * 通过 WebSocket 连接到目标服务器执行命令
 */
function executeCommandViaWebSocket(command) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(TARGET_WS_URL);

    const stdout = [];
    const stderr = [];
    let exitCode = null;
    let timeout;

    // 30秒超时
    timeout = setTimeout(() => {
      ws.close();
      reject(new Error('命令执行超时'));
    }, 30000);

    ws.on('open', () => {
      console.log(`[WebSocket] 已连接到 ${TARGET_WS_URL}`);

      // 发送执行命令
      ws.send(JSON.stringify({
        type: 'exec',
        command: command
      }));
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        console.log(`[WebSocket] 收到消息类型: ${msg.type}`);

        switch (msg.type) {
          case 'connected':
            console.log(`[WebSocket] 连接成功: ${msg.message}`);
            break;

          case 'status':
            console.log(`[WebSocket] 状态: ${msg.message}`);
            break;

          case 'stdout':
            stdout.push(msg.data);
            process.stdout.write(msg.data); // 实时输出到控制台
            break;

          case 'stderr':
            stderr.push(msg.data);
            process.stderr.write(msg.data); // 实时输出到控制台
            break;

          case 'completed':
            exitCode = msg.code;
            clearTimeout(timeout);
            ws.close();

            resolve({
              stdout: stdout.join(''),
              stderr: stderr.join(''),
              exitCode: exitCode
            });
            break;

          case 'error':
            clearTimeout(timeout);
            ws.close();
            reject(new Error(msg.message));
            break;
        }
      } catch (e) {
        console.error('[WebSocket] 解析消息失败:', e.message);
      }
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      reject(new Error(`WebSocket 错误: ${error.message}`));
    });

    ws.on('close', () => {
      console.log('[WebSocket] 连接已关闭');
    });
  });
}

// 健康检查接口
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    targetWebSocket: TARGET_WS_URL,
    timestamp: new Date().toISOString()
  });
});

// 根路径提示
app.get('/', (req, res) => {
  res.json({
    message: 'WebSocket Exec HTTP 代理服务',
    endpoints: {
      'POST /api/exec': '执行命令 (JSON body: { "command": "..." })',
      'GET /api/exec?command=...': '执行命令 (URL 参数)',
      'GET /health': '健康检查'
    },
    targetWebSocket: TARGET_WS_URL
  });
});

app.listen(PORT, () => {
  console.log(`HTTP 代理服务运行在 http://localhost:${PORT}`);
  console.log(`目标 WebSocket 服务器: ${TARGET_WS_URL}`);
  console.log('');
  console.log('可用接口:');
  console.log(`  POST http://localhost:${PORT}/api/exec`);
  console.log(`  GET  http://localhost:${PORT}/api/exec?command=ls%20-la`);
  console.log(`  GET  http://localhost:${PORT}/health`);
});
