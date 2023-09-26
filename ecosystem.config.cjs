module.exports = {
  apps : [{
		name: 'goonhub-event-processor',
    script: 'src/index.js',
		instances: 2,
		exec_mode: 'cluster',
		env_production: {
			NODE_ENV: "production",
      PM2_KILL_SIGNAL: 'SIGTERM'
		},
		env_development: {
			NODE_ENV: "development",
      PM2_KILL_SIGNAL: 'SIGTERM'
		}
  }]
};
