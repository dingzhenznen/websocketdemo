// const util = require('util');
// const exec = util.promisify(require('child_process').exec);

async function lsExample() {
  const { stdout, stderr } = await exec('ls');
  console.log('stdout:', stdout);
  console.log('stderr:', stderr);
}
// lsExample();


const util = require('util');
const { exec } = require('child_process');

async function lsExample() {
  const res =  exec('ls');
  res.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`);
    });

  res.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
  });
}
lsExample();