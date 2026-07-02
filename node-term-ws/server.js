const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const express = require('express');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || '127.0.0.1';

app.use('/vendor/xterm', express.static(path.join(__dirname, 'node_modules', 'xterm', 'lib')));
app.use('/vendor/xterm-css', express.static(path.join(__dirname, 'node_modules', 'xterm', 'css')));
app.use(
  '/vendor/xterm-addon-fit',
  express.static(path.join(__dirname, 'node_modules', '@xterm', 'addon-fit', 'lib'))
);
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

function send(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function createCommandRunner(ws) {
  let currentChild = null;

  function run(command) {
    if (currentChild) {
      send(ws, { type: 'stderr', data: '[busy] previous command is still running\r\n' });
      return;
    }

    const trimmed = command.trim();
    if (!trimmed) {
      send(ws, { type: 'prompt' });
      return;
    }

    const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/sh';
    const shellArgs = process.platform === 'win32' ? ['-Command', trimmed] : ['-lc', trimmed];

    send(ws, { type: 'started', command: trimmed });

    currentChild = spawn(shell, shellArgs, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    currentChild.stdout.on('data', (chunk) => {
      send(ws, { type: 'stdout', data: chunk.toString() });
    });

    currentChild.stderr.on('data', (chunk) => {
      send(ws, { type: 'stderr', data: chunk.toString() });
    });

    currentChild.on('close', (code, signal) => {
      currentChild = null;
      send(ws, { type: 'exit', code, signal });
      send(ws, { type: 'prompt' });
    });

    currentChild.on('error', (error) => {
      currentChild = null;
      send(ws, { type: 'stderr', data: `[spawn error] ${error.message}\r\n` });
      send(ws, { type: 'prompt' });
    });
  }

  function stop() {
    if (!currentChild) {
      send(ws, { type: 'stderr', data: '[idle] no running command\r\n' });
      send(ws, { type: 'prompt' });
      return;
    }

    currentChild.kill('SIGTERM');
  }

  function cleanup() {
    if (currentChild) {
      currentChild.kill('SIGTERM');
      currentChild = null;
    }
  }

  return { run, stop, cleanup };
}

wss.on('connection', (ws) => {
  const runner = createCommandRunner(ws);

  send(ws, {
    type: 'ready',
    mode: 'child_process',
    cwd: process.cwd(),
    note: 'Each submitted line runs as a new shell command. No persistent PTY session.',
  });
  send(ws, { type: 'prompt' });

  ws.on('message', (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      send(ws, { type: 'stderr', data: '[protocol error] invalid json\r\n' });
      send(ws, { type: 'prompt' });
      return;
    }

    if (message.type === 'run' && typeof message.command === 'string') {
      runner.run(message.command);
      return;
    }

    if (message.type === 'stop') {
      runner.stop();
      return;
    }

    send(ws, { type: 'stderr', data: `[protocol error] unsupported message type: ${message.type}\r\n` });
    send(ws, { type: 'prompt' });
  });

  ws.on('close', () => {
    runner.cleanup();
  });
});

server.listen(port, host, () => {
  console.log(`Command terminal listening on http://${host}:${port}`);
});
