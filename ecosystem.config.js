module.exports = {
    apps: [{
        name: "botis",
        script: "./app.js",
        watch: false,
        max_memory_restart: '1000M',
        exec_mode: "cluster",
        instances: 1,
        cron_restart: "59 23 * * *",
        env_production: {
            NODE_ENV: "production"
        },
        env_development: {
            NODE_ENV: "development"
        }
    }]
}