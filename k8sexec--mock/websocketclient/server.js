const express = require('express');
const WebSocket = require('ws');
const { PassThrough } = require('node:stream');

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
    const result = await runCommand(command);
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
    const result = await runCommand(command);
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
 * 创建 WebSocket 连接并发送命令
 * 类似于 k8s exec - 返回 Promise<WebSocket>
 * @param {string} command - 要执行的命令
 * @param {PassThrough} stdoutPass - stdout 输出流
 * @param {PassThrough} stderrPass - stderr 输出流
 * @returns {Promise<WebSocket>} WebSocket 实例
 */
function executeCommandViaWebSocket(command, stdoutPass, stderrPass) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(TARGET_WS_URL);

    ws.on('open', () => {
      console.log(`[WebSocket] 已连接到 ${TARGET_WS_URL}`);

      // 发送执行命令
      ws.send(JSON.stringify({
        type: 'exec',
        command: command
      }));

      // 连接成功后 resolve
      resolve(ws);
    });

    // 将 WebSocket 消息转发到 PassThrough 流
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());

        switch (msg.type) {
          case 'stdout':
            stdoutPass.write(msg.data);
            break;
          case 'stderr':
            stderrPass.write(msg.data);
            break;
          case 'completed':
            stdoutPass.exitCode = msg.code;
            stdoutPass.end();
            stderrPass.end();
            ws.close();
            break;
          case 'error':
            stdoutPass.error = new Error(msg.message);
            stdoutPass.end();
            stderrPass.end();
            ws.close();
            break;
        }
      } catch (e) {
        console.error('[WebSocket] 解析消息失败:', e.message);
      }
    });

    ws.on('error', (error) => {
      stdoutPass.error = error;
      stdoutPass.end();
      stderrPass.end();
      reject(error);
    });

    ws.on('close', () => {
      console.log('[WebSocket] 连接已关闭');
    });
  });
}

/**
 * 运行命令并收集输出
 * 在 executeCommandViaWebSocket 的 then 方法中处理流
 */
function runCommand(command) {
  // 创建 PassThrough 流作为中间层
  const stdoutPass = new PassThrough();
  const stderrPass = new PassThrough();

  const stdout = [];
  const stderr = [];

  // 先设置好流的事件监听
  stdoutPass.on('data', (chunk) => {
    console.log('[PassThrough stdout] 收到数据:', chunk.toString().trim());
    stdout.push(chunk.toString());
  });

  stderrPass.on('data', (chunk) => {
    console.log('[PassThrough stderr] 收到数据:', chunk.toString().trim());
    stderr.push(chunk.toString());
  });

  stderrPass.on('end', () => {
    console.log('[PassThrough stderr] 流结束');
  });

  stdoutPass.on('error', (error) => {
    console.error('[PassThrough stdout] 错误:', error.message);
  });

  stderrPass.on('error', (error) => {
    console.error('[PassThrough stderr] 错误:', error.message);
  });

  // 创建 WebSocket 连接，在 then 中处理 stdoutPass 的 end 事件
  return executeCommandViaWebSocket(command, stdoutPass, stderrPass)
    .then((ws) => {
      console.log('[runCommand] WebSocket 连接成功，开始监听流结束');

      // 在 then 中返回新的 Promise，等待流结束
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('命令执行超时'));
        }, 30000);

        // 在 then 方法中监听 stdoutPass 的 end 事件
        stdoutPass.on('end', () => {
          console.log('[PassThrough stdout] 流结束');
          clearTimeout(timeout);

          if (stdoutPass.error) {
            reject(stdoutPass.error);
          } else {
            resolve({
              stdout: stdout.join(''),
              stderr: stderr.join(''),
              exitCode: stdoutPass.exitCode || 0
            });
          }
        });

        ws.on('close', () => {
          console.log('[WebSocket]222 监听到连接关闭');
        });
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
