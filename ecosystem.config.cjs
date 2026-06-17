module.exports = {
  apps: [
    {
      name: "workshop-ai-link-api",
      cwd: "/opt/workshop-ai-link/backend",
      script: "server.js",
      env: {
        NODE_ENV: "production",
        PORT: 3010,
      },
    },
    {
      name: "workshop-ai-link-web",
      script: "/opt/workshop-ai-link/deploy/start-web.sh",
      interpreter: "bash",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
