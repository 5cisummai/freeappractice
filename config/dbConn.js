const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDb = async () => {
    try {
        if (!process.env.DATABASE_URI) {
            throw new Error('DATABASE_URI environment variable is not defined');
        }
        
        await mongoose.connect(process.env.DATABASE_URI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        
        logger.info('MongoDB connected successfully');
    }
    catch (error) {
        logger.error('MongoDB connection error:', error);
        console.error('MongoDB connection error:', error);
        // Don't exit process, let the app continue but log the error
    }
};

// Handle MongoDB connection events
mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected. Attempting to reconnect...');
});

module.exports = connectDb;