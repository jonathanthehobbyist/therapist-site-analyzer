const fs = require('fs');
const path = require('path');

// Parse .env.local and pass vars to the app
const envLocal = {};
const envFile = path.join('/home/ec2-user/app', '.env.local');
if (fs.existsSync(envFile)) {
  const lines = fs.readFileSync(envFile, 'utf8').split('\n');
  for (const line of lines) {
    const idx = line.indexOf('=');
    if (idx === -1 || line.startsWith('#')) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    // Strip surrounding quotes
    if ((val.startsWith("'") && val.endsWith("'")) ||
        (val.startsWith('"') && val.endsWith('"'))) {
      val = val.slice(1, -1);
    }
    if (key) envLocal[key] = val;
  }
}

module.exports = {
  apps: [{
    name: 'therapist-analyzer',
    script: 'node_modules/.bin/next',
    args: 'start',
    cwd: '/home/ec2-user/app',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      ...envLocal
    },
    restart_delay: 5000,
    max_restarts: 10
  }]
}
