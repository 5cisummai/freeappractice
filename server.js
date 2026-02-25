require('dotenv').config();
const express = require('express');
const path = require('path');
const logger = require('./utils/logger');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const app = express();
const PORT = process.env.PORT || 3000;
const connectDb = require('./config/dbConn');

const NODE_ENV = process.env.NODE_ENV || 'development';

//Conect to MongoDB
connectDb();

const helmet = require('helmet');

// Security headers (migrated to helmet)
// helmet sets a sane default set of protections including the headers
// previously configured manually.  Additional configuration is applied
// for HSTS in production to match the earlier behavior.
app.use(helmet());

if (NODE_ENV === 'production') {
    // express-rate-limit already disables the legacy headers; helmet.hsts only
    // needs to be enabled when running over HTTPS in production.
    app.use(
        helmet.hsts({
            maxAge: 31536000,
            includeSubDomains: true,
        })
    );
}

// API rate limiting
const apiRateLimiter = rateLimit({
    windowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max: parseInt(process.env.API_RATE_LIMIT_MAX, 10) || 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Too many requests from this IP, please try again later.'
    }
});

app.use('/api/', apiRateLimiter);

// Request logging
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info('request completed', {
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration,
            userAgent: req.headers['user-agent']
        });
    });
    next();
});

// Body parsing middleware with limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
const questionRouter = require('./routes/api/question');
const questionByIdRouter = require('./routes/api/question-by-id');
const bugReportRouter = require('./routes/api/bug-report');
const authRouter = require('./routes/api/auth');
const tutorRouter = require('./routes/api/tutor');
const s3Router = require('./routes/api/s3');
app.use('/api/question', questionRouter);
app.use('/api/question', questionByIdRouter);
app.use('/api/bug-report', bugReportRouter);
app.use('/api/auth', authRouter);
app.use('/api/tutor', tutorRouter);
app.use('/api/s3', s3Router);

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: NODE_ENV === 'production' ? '1h' : 0,
    etag: true
}));

// Serve data directory for JSON files
app.use('/data', express.static(path.join(__dirname, 'data'), {
    maxAge: NODE_ENV === 'production' ? '1d' : 0,
    etag: true
}));

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});

// Global error handler
app.use((err, req, res, next) => {
    logger.error('Unhandled error', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
    });
    res.status(err.status || 500).json({
        error: NODE_ENV === 'production' ? 'Internal Server Error' : err.message
    });
});

// Graceful shutdown
let server;

mongoose.connection.once('open', () => {
    console.log('Mongoose connected to MongoDB');
});

if (NODE_ENV !== 'test') {
    server = app.listen(PORT, () => {
        console.log(`Server running on port ${PORT} in ${NODE_ENV} mode`);
        if (!process.env.OPEN_AI_KEY && !process.env.OPENAI_API_KEY) {
            console.warn('Warning: No OpenAI API key configured');
        }
    });

    process.on('SIGTERM', () => {
        console.log('SIGTERM received, shutting down gracefully...');
        server.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
    });

    process.on('SIGINT', () => {
        console.log('SIGINT received, shutting down gracefully...');
        server.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
    });
}

module.exports = app;
