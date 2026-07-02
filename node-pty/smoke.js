const pty = require('node-pty');
const { ensureSpawnHelperExecutable } = require('./pty-helper');

ensureSpawnHelperExecutable();

const shell = process.platform === 'win32'
  ? 'powershell.exe'
  : process.env.SHELL || 'bash';

const term = pty.spawn(shell, [], {
  name: 'xterm-256color',
  cols: 80,
  rows: 24,
  cwd: process.cwd(),
  env: process.env,
});

let output = '';

term.onData((data) => {
  output += data;
});

term.onExit(({ exitCode, signal }) => {
  const normalized = output.replace(/\r/g, '');
  const ok = normalized.includes('hello-from-node-pty');
  if (!ok || exitCode !== 0) {
    process.stderr.write('Smoke test failed.\n');
    process.stderr.write(`exitCode=${exitCode} signal=${signal}\n`);
    process.stderr.write(`output=\n${normalized}\n`);
    process.exit(1);
  }
  process.stdout.write('Smoke test passed.\n');
  process.exit(0);
});

if (process.platform === 'win32') {
  term.write('Write-Output "hello-from-node-pty"\r');
  term.write('exit\r');
} else {
  term.write('echo "hello-from-node-pty"\n');
  term.write('exit\n');
}
