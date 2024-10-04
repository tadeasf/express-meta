module.exports = {
  apps: [
    {
      name: 'elysia-app',
      script: 'bun',
      args: 'run src/index.ts',
      interpreter: '',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        MONGODB_URI: 'your_mongodb_uri_here',
        // Add any other environment variables your app needs
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3001,
        MONGODB_URI: 'your_development_mongodb_uri_here',
        // Add any other environment variables for development
      },
      instances: 'max', // or a number like 4
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
