const pty = require('node-pty');
const { ensureSpawnHelperExecutable } = require('./pty-helper');

ensureSpawnHelperExecutable();

const shell = process.platform === 'win32'
  ? 'powershell.exe'
  : process.env.SHELL || 'bash';

const term = pty.spawn(shell, [], {
  name: 'xterm-256color',
  cols: process.stdout.columns || 80,
  rows: process.stdout.rows || 24,
  cwd: process.cwd(),
  env: process.env,
});

term.onData((data) => {
  process.stdout.write(data);
});

term.onExit(({ exitCode, signal }) => {
  process.stdout.write(`\n[pty exit] code=${exitCode} signal=${signal}\n`);
  process.exit(exitCode ?? 0);
});

if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}

process.stdin.resume();
process.stdin.on('data', (data) => {
  term.write(data.toString());
});

if (process.stdout.isTTY) {
  process.stdout.on('resize', () => {
    term.resize(process.stdout.columns || 80, process.stdout.rows || 24);
  });
}

process.stdout.write(`PTY started with shell: ${shell}\n`);
process.stdout.write('Type commands. Use Ctrl+D or `exit` to quit.\n\n');
