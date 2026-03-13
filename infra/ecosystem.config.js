module.exports = {
  apps: [{
    name: 'therapist-analyzer',
    script: 'node_modules/.bin/next',
    args: 'start',
    cwd: '/home/ec2-user/app',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    restart_delay: 5000,
    max_restarts: 10
  }]
}
