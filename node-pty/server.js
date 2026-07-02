const http = require('node:http');
const path = require('node:path');
const express = require('express');
const WebSocket = require('ws');
const pty = require('node-pty');
const { ensureSpawnHelperExecutable } = require('./pty-helper');

ensureSpawnHelperExecutable();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
const shell = process.platform === 'win32'
  ? 'powershell.exe'
  : process.env.SHELL || 'bash';

app.use('/vendor/xterm', express.static(path.join(__dirname, 'node_modules', '@xterm', 'xterm', 'lib')));
app.use('/vendor/xterm-css', express.static(path.join(__dirname, 'node_modules', '@xterm', 'xterm', 'css')));
app.use(
  '/vendor/xterm-addon-fit',
  express.static(path.join(__dirname, 'node_modules', '@xterm', 'addon-fit', 'lib'))
);
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

wss.on('connection', (ws) => {
  const term = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: process.cwd(),
    env: process.env,
  });

  ws.send(JSON.stringify({ type: 'ready', shell }));

  term.onData((data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'output', data }));
    }
  });

  term.onExit(({ exitCode, signal }) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'exit', exitCode, signal }));
      ws.close();
    }
  });

  ws.on('message', (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (message.type === 'input' && typeof message.data === 'string') {
      term.write(message.data);
      return;
    }

    if (
      message.type === 'resize' &&
      Number.isInteger(message.cols) &&
      Number.isInteger(message.rows) &&
      message.cols > 0 &&
      message.rows > 0
    ) {
      term.resize(message.cols, message.rows);
    }
  });

  ws.on('close', () => {
    term.kill();
  });
});

server.listen(port, host, () => {
  console.log(`Web terminal listening on http://${host}:${port}`);
});
