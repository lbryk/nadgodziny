// PM2: `pm2 start ecosystem.config.cjs && pm2 save && pm2 startup`
module.exports = {
  apps: [
    {
      name: 'nadgodziny',
      script: 'server/index.js',
      cwd: __dirname,
      env_file: '.env',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '300M',
      time: true,
    },
  ],
};
