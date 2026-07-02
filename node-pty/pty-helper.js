const fs = require('node:fs');
const path = require('node:path');

function ensureSpawnHelperExecutable() {
  if (process.platform !== 'darwin') {
    return;
  }

  const packageJsonPath = require.resolve('node-pty/package.json');
  const packageDir = path.dirname(packageJsonPath);
  const helperPath = path.join(packageDir, 'prebuilds', `darwin-${process.arch}`, 'spawn-helper');

  if (!fs.existsSync(helperPath)) {
    return;
  }

  const mode = fs.statSync(helperPath).mode & 0o777;
  if ((mode & 0o111) === 0) {
    fs.chmodSync(helperPath, mode | 0o755);
  }
}

module.exports = {
  ensureSpawnHelperExecutable,
};
