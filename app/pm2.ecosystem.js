module.exports = {
  apps: [
    {
      name: 'elysia-app',
      script: 'src/index.ts',
      interpreter: '~/.bun/bin/bun',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        // Use the MONGODB_URI from .env
        MONGODB_URI: process.env.MONGODB_URI,
        MONGODB_DB_NAME: process.env.MONGODB_DB_NAME,
        GITHUB_TOKEN: process.env.GITHUB_TOKEN,
        USERNAME: process.env.USERNAME,
        PASSWORD: process.env.PASSWORD,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3001,
        // Use the MONGODB_URI_CONTABO from .env for development
        MONGODB_URI: process.env.MONGODB_URI_CONTABO,
        MONGODB_DB_NAME: process.env.MONGODB_DB_NAME,
        GITHUB_TOKEN: process.env.GITHUB_TOKEN,
        USERNAME: process.env.USERNAME,
        PASSWORD: process.env.PASSWORD,
      },
      instances: 'max',
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '1G',
      error_file: 'logs/err.log',
      out_file: 'logs/out.log',
      log_file: 'logs/combined.log',
      time: true,
      autorestart: true,
      restart_delay: 1000,
      merge_logs: true,
    },
  ],
};
