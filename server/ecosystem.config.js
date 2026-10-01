// pm2 config: from the server/ folder run `pm2 start ecosystem.config.js`, then `pm2 save`.
// Settings come from server/.env (loaded by server.js itself).
module.exports = {
  apps: [
    {
      name: "bravestream-server",
      script: "server.js",
      cwd: __dirname,
      autorestart: true,
      // Restart if memory runs away; the catalogues alone use a few hundred MB
      max_memory_restart: "1500M",
      // Wait between crash restarts so a broken config doesn't spin
      restart_delay: 5000,
      time: true, // timestamps in `pm2 logs`
    },
  ],
};
