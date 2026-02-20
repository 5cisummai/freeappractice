const fs = require('fs');
const path = require('path');
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, errors, colorize } = format;

const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

const logFormat = printf(({ timestamp, level, message, stack, ...meta }) => {
    const base = `${timestamp} ${level}: ${message}`;
    if (stack) {
        return `${base}\n${stack}\n${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
    }
    return Object.keys(meta).length ? `${base} ${JSON.stringify(meta)}` : base;
});

const logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(
        timestamp(),
        errors({ stack: true }),
        logFormat
    ),
    transports: [
        new transports.File({ filename: path.join(logsDir, 'error.log'), level: 'error' }),
        new transports.File({ filename: path.join(logsDir, 'combined.log') })
    ],
    exceptionHandlers: [
        new transports.File({ filename: path.join(logsDir, 'exceptions.log') })
    ]
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new transports.Console({
        format: combine(colorize(), timestamp(), errors({ stack: true }), logFormat)
    }));
}

module.exports = logger;