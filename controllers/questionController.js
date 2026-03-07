const DEFAULT_PROVIDER = 'openai';

const getCacheStats = async (req, res) => {
    try {
        const questionCache = require('../services/questionCache');
        const stats = await questionCache.getCacheStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get cache stats', details: error.message });
    }
};

const generateCachedQuestion = async (req, res) => {
    try {
        const { className, unit } = req.body;
        if (typeof className !== 'string' || !className.trim()) {
            return res.status(400).json({ error: 'className is required and must be a non-empty string' });
        }
        if (unit !== undefined && typeof unit !== 'string') {
            return res.status(400).json({ error: 'unit must be a string if provided' });
        }

        const questionCache = require('../services/questionCache');
        const result = await questionCache.generateAndStoreQuestion(className.trim(), unit || '', DEFAULT_PROVIDER);
        res.json({ success: true, message: 'Question generated and cached', data: result });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate question', details: error.message });
    }
};

const generateQuestion = async (req, res) => {
    try {
        const { className, unit, skipCache } = req.body;

        if (typeof className !== 'string' || !className.trim()) {
            return res.status(400).json({ error: 'className is required and must be a non-empty string' });
        }
        if (unit !== undefined && typeof unit !== 'string') {
            return res.status(400).json({ error: 'unit must be a string if provided' });
        }

        let result;

        if (skipCache) {
            const aiService = require('../services/aiService');
            result = await aiService.generateAPQuestion({ className, unit });

            if (typeof result.answer === 'string') {
                try {
                    result.answer = JSON.parse(result.answer);
                } catch (e) {
                    // Keep as string if parse fails
                }
            }
        } else {
            const questionCache = require('../services/questionCache');
            result = await questionCache.getCachedQuestion(className, unit || '', DEFAULT_PROVIDER);
        }

        if (typeof result.answer === 'object') {
            return res.json({
                answer: JSON.stringify(result.answer),
                provider: result.provider,
                model: result.model,
                cached: result.cached,
                questionId: result.questionId
            });
        }

        return res.json({
            answer: result.answer,
            provider: result.provider,
            model: result.model,
            cached: result.cached,
            questionId: result.questionId
        });
    } catch (error) {
        console.error(`Error generating question [${DEFAULT_PROVIDER}]:`, error.message);
        if (process.env.NODE_ENV !== 'production') {
            console.error('Stack:', error.stack);
        }

        res.status(500).json({
            error: 'Failed to generate question',
            details: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
            provider: DEFAULT_PROVIDER
        });
    }
};

module.exports = {
    getCacheStats,
    generateCachedQuestion,
    generateQuestion
};
