module.exports = {
  apps: [{
    name: 'gardenpin',
    script: './backend/server.js',
    cwd: '/home/dell_5090/zahradni-tracker',
    env: { NODE_ENV: 'production', PORT: 3000 },
    restart_delay: 3000,
    max_restarts: 10
  }]
}
