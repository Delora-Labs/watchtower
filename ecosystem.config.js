module.exports = {
  apps: [
    {
      name: "watchtower",
      script: "npm",
      args: "start -- -p 3020",
      cwd: "/home/clawdbot/workspace/watchtower",
      env: {
        NODE_ENV: "production",
        DB_HOST: "46.101.215.137",
        DB_PORT: "3306",
        DB_DATABASE: "watchtower",
        DB_USERNAME: "watchtower",
        DB_PASSWORD: "W7x!pQ9#rL2@tV6",
      },
    },
  ],
};
