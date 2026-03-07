require('dotenv').config();
const mongoose = require('mongoose');
const connectDb = require('../config/dbConn');
const User = require('../models/User');

const DEFAULT_TTL_DAYS = 7;
const ttlDaysFromEnv = parseInt(process.env.UNVERIFIED_USER_TTL_DAYS, 10);
const ttlDays = Number.isNaN(ttlDaysFromEnv) ? DEFAULT_TTL_DAYS : ttlDaysFromEnv;

async function cleanupUnverifiedUsers() {
    await connectDb();

    if (mongoose.connection.readyState !== 1) {
        throw new Error('MongoDB is not connected');
    }

    const cutoffDate = new Date(Date.now() - ttlDays * 24 * 60 * 60 * 1000);

    const result = await User.deleteMany({
        verified: false,
        createdAt: { $lt: cutoffDate }
    });

    console.log(`Deleted ${result.deletedCount} unverified users created before ${cutoffDate.toISOString()}`);
}

cleanupUnverifiedUsers()
    .catch((err) => {
        console.error('Failed to clean up unverified users:', err.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        try {
            await mongoose.connection.close();
        } catch (closeErr) {
            console.error('Failed to close MongoDB connection:', closeErr.message);
        }
    });
