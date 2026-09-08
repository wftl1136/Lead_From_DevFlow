module.exports = {
  apps: [
    {
      name: 'lead-agent',
      script: 'node_modules/.bin/tsx',
      args: 'src/index.ts',
      cwd: '/Users/maksym/lead-finder-agent',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
