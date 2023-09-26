module.exports = {
  apps : [{
		name: 'goonhub-event-processor',
    script: 'src/index.js',
		instances: 2,
		exec_mode: 'cluster',
		env_production: {
			NODE_ENV: "production"
		},
		env_development: {
			NODE_ENV: "development"
		}
  }]
};
