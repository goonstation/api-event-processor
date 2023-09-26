module.exports = {
  apps : [{
		name: 'goonhub-event-processor',
    script: 'src/index.js',
		instances: 2,
		exec_mode: 'cluster',
		ignore_watch: [
			'node_modules',
			'.git'
		],
		env_development: {
			NODE_ENV: "development",
      PM2_KILL_SIGNAL: 'SIGTERM'
		}
  }]
};
