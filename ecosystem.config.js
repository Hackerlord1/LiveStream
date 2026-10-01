// pm2 config for running everything on the server computer:
//   bravestream-web     the website (Next.js production server on :3000)
//   bravestream-server  the stream/API server (:3477)
//   caddy               HTTPS for bravestream.live, www and api (see server/Caddyfile)
//
// From the repo root:  pm2 start ecosystem.config.js  then  pm2 save
// Build the website first:  npm ci  then  npm run build
module.exports = {
  apps: [
    {
      name: "bravestream-web",
      cwd: __dirname,
      // Run Next directly (not via `npm start`): npm's wrapper doesn't run reliably under pm2 on Windows
      script: `${__dirname}/node_modules/next/dist/bin/next`,
      args: "start -p 3000",
      env: { NODE_ENV: "production" },
      autorestart: true,
      max_memory_restart: "1G",
      restart_delay: 5000,
      time: true,
    },
    {
      name: "bravestream-server",
      cwd: `${__dirname}/server`,
      script: "server.js",
      autorestart: true,
      max_memory_restart: "1500M",
      restart_delay: 5000,
      time: true,
    },
    {
      name: "caddy",
      script: "caddy",
      interpreter: "none",
      args: `run --config "${__dirname}/server/Caddyfile"`,
      autorestart: true,
      restart_delay: 5000,
      time: true,
    },
  ],
};
