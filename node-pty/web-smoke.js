const { spawn } = require('node:child_process');
const http = require('node:http');
const WebSocket = require('ws');

const port = 3100 + Math.floor(Math.random() * 200);

function waitForHealth() {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tryOnce = () => {
      const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          if (res.statusCode === 200 && body.includes('"ok":true')) {
            resolve();
            return;
          }
          retry();
        });
      });

      req.on('error', retry);
    };

    const retry = () => {
      if (Date.now() - started > 10000) {
        reject(new Error('server did not become healthy in time'));
        return;
      }
      setTimeout(tryOnce, 150);
    };

    tryOnce();
  });
}

async function main() {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: __dirname,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let serverOutput = '';
  child.stdout.on('data', (chunk) => {
    serverOutput += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    serverOutput += chunk.toString();
  });

  try {
    await waitForHealth();

    await new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      let combinedOutput = '';

      const timer = setTimeout(() => {
        ws.terminate();
        reject(new Error(`timeout waiting for websocket output\n${combinedOutput}`));
      }, 10000);

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'input', data: 'echo web-smoke-ok\n' }));
        ws.send(JSON.stringify({ type: 'input', data: 'exit\n' }));
      });

      ws.on('message', (raw) => {
        const message = JSON.parse(raw.toString());
        if (message.type === 'output') {
          combinedOutput += message.data;
        }
        if (message.type === 'exit') {
          clearTimeout(timer);
          if (combinedOutput.includes('web-smoke-ok')) {
            resolve();
            return;
          }
          reject(new Error(`missing expected output\n${combinedOutput}`));
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    process.stdout.write('Web smoke test passed.\n');
  } finally {
    child.kill('SIGTERM');
  }
}

main().catch((err) => {
  process.stderr.write(`${err.stack || err.message}\n`);
  process.exit(1);
});
