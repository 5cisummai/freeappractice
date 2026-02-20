module.exports = {
  apps: [{
    name: "freeappractice",
    "script": "./server.js",
    "instances": 2,
    "exec_mode": "cluster",
    "env": {
      "NODE_ENV": "production",
      "PORT": 3000
    },
    "error_file": "./logs/err.log",
    "out_file": "./logs/out.log",
    "log_date_format": "YYYY-MM-DD HH:mm:ss Z",
    "merge_logs": true,
    "autorestart": true,
    "max_restarts": 10,
    "min_uptime": "10s",
    "max_memory_restart": "500M"
  }]
}
