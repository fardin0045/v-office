const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
const serverDir = path.resolve(rootDir, 'server');
const clientDir = path.resolve(rootDir, 'client');

// Find npm executable
const isWin = process.platform === 'win32';
let npmCmd = isWin ? 'npm.cmd' : 'npm';

const defaultNodePath = 'C:\\Program Files\\nodejs';
if (isWin && fs.existsSync(path.join(defaultNodePath, 'npm.cmd'))) {
  npmCmd = path.join(defaultNodePath, 'npm.cmd');
}

const env = { ...process.env };
if (isWin && fs.existsSync(defaultNodePath) && !env.PATH.includes(defaultNodePath)) {
  env.PATH = `${defaultNodePath};${env.PATH}`;
}

function runInstall(targetDir, name) {
  console.log(`\n==============================================`);
  console.log(`  Installing dependencies for: ${name}...`);
  console.log(`  Directory: ${targetDir}`);
  console.log(`==============================================`);

  const result = spawnSync(npmCmd, ['install'], {
    cwd: targetDir,
    stdio: 'inherit',
    env,
    shell: true,
  });

  if (result.status !== 0) {
    console.error(`Failed to install dependencies for ${name}`);
    process.exit(result.status || 1);
  }
}

console.log('Starting full V-Office installation...');
runInstall(rootDir, 'Root Project');
runInstall(serverDir, 'Backend Server');
runInstall(clientDir, 'Frontend Client');

console.log('\n[V-OFFICE] All dependencies installed successfully!');
console.log('You can now run:');
console.log('  npm run seed   (seed demo database)');
console.log('  npm run dev    (start V-Office server & 3D client)\n');
