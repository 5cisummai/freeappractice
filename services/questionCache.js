const Question = require('../models/Question');
const aiService = require('./aiService');
const connectDb = require('../config/dbConn');

// Ensure DB connection
let dbConnected = false;
async function ensureDbConnection() {
    if (!dbConnected) {
        await connectDb();
        dbConnected = true;
    }
}

/**
 * Generate a new question using AI service and store it in the database
 * @param {string} className - The AP class name
 * @param {string} unit - The unit identifier
 * @param {string} provider - AI provider ('local' or 'openai')
 * @returns {Promise<Object>} The generated question data
 */
async function generateAndStoreQuestion(className, unit, provider = 'openai') {
    await ensureDbConnection();

    try {
        // Generate question using AI service
        const result = await aiService.generateAPQuestion({
            className,
            unit,
            provider
        });

        // Parse the answer if it's a string (for local provider)
        let questionData;
        if (typeof result.answer === 'string') {
            questionData = JSON.parse(result.answer);
        } else {
            questionData = result.answer;
        }

        // Update or create the cached question in database
        const cachedQuestion = await Question.findOneAndUpdate(
            { apClass: className, unit: unit },
            {
                apClass: className,
                unit: unit,
                question: questionData.question,
                optionA: questionData.optionA,
                optionB: questionData.optionB,
                optionC: questionData.optionC,
                optionD: questionData.optionD,
                correctAnswer: questionData.correctAnswer,
                explanation: questionData.explanation
            },
            { upsert: true, new: true, runValidators: true }
        );

        return {
            answer: questionData,
            provider: result.provider,
            model: result.model,
            cached: false,
            questionId: cachedQuestion._id.toString()
        };
    } catch (error) {
        console.error('Error generating and storing question:', error.message);
        throw error;
    }
}

/**
 * Refresh a cached question in the background (non-blocking)
 * @param {string} className - The AP class name
 * @param {string} unit - The unit identifier
 * @param {string} provider - AI provider ('local' or 'openai')
 */
function refreshQuestionBackground(className, unit) {
    // Always use OpenAI for database cache
    generateAndStoreQuestion(className, unit, 'openai')
        .then(() => {
            if (process.env.NODE_ENV !== 'production') {
                console.log(`✅ Background refresh completed: ${className} - ${unit}`);
            }
        })
        .catch((error) => {
            console.error(`❌ Background refresh failed for ${className} - ${unit}:`, error.message);
            // If it fails, log but don't crash - the old cached question will remain
        });
}

/**
 * Get a cached question from database, then refresh it in the background
 * If no cached question exists, generate one immediately
 * @param {string} className - The AP class name
 * @param {string} unit - The unit identifier (can be empty for "all units")
 * @param {string} provider - AI provider ('local' or 'openai')
 * @returns {Promise<Object>} The question data
 */
async function getCachedQuestion(className, unit = '', provider = 'openai') {
    await ensureDbConnection();

    try {
        // Try to find cached question
        const cached = await Question.findOne({ apClass: className, unit: unit });

        if (cached) {
            // Return cached question immediately
            const questionData = {
                question: cached.question,
                optionA: cached.optionA,
                optionB: cached.optionB,
                optionC: cached.optionC,
                optionD: cached.optionD,
                correctAnswer: cached.correctAnswer,
                explanation: cached.explanation
            };

            // Trigger background refresh to generate new question for next time
            if (process.env.NODE_ENV !== 'production') {
                console.log(`🔄 Triggering background refresh for ${className} - ${unit} (using ${provider})`);
            }
            setImmediate(() => {
                refreshQuestionBackground(className, unit, provider);
            });

            return {
                answer: questionData,
                provider: 'cache',
                model: 'cached',
                cached: true,
                questionId: cached._id.toString()
            };
        } else {
            // No cached question - generate immediately
            console.log(`No cached question for ${className} - ${unit}, generating new one with ${provider}`);
            return await generateAndStoreQuestion(className, unit, provider);
        }
    } catch (error) {
        console.error('Error getting cached question:', error.message);
        throw error;
    }
}

/**
 * Check if a question exists in cache
 * @param {string} className - The AP class name
 * @param {string} unit - The unit identifier
 * @returns {Promise<boolean>} True if cached, false otherwise
 */
async function isCached(className, unit = '') {
    await ensureDbConnection();
    const count = await Question.countDocuments({ apClass: className, unit: unit });
    return count > 0;
}

/**
 * Clear all cached questions (useful for testing or reset)
 * @returns {Promise<number>} Number of questions deleted
 */
async function clearCache() {
    await ensureDbConnection();
    const result = await Question.deleteMany({});
    return result.deletedCount;
}

/**
 * Get statistics about the cache
 * @returns {Promise<Object>} Cache statistics
 */
async function getCacheStats() {
    await ensureDbConnection();
    const total = await Question.countDocuments();
    const byClass = await Question.aggregate([
        { $group: { _id: '$apClass', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
    ]);
    return { total, byClass };
}

module.exports = {
    getCachedQuestion,
    generateAndStoreQuestion,
    refreshQuestionBackground,
    isCached,
    clearCache,
    getCacheStats
};
