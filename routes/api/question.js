const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const DEFAULT_PROVIDER = 'openai';
const OPENAI_RATE_LIMIT = parseInt(process.env.OPENAI_RATE_LIMIT_MAX, 10) || 15;
const OPENAI_RATE_WINDOW = parseInt(process.env.OPENAI_RATE_LIMIT_WINDOW_MS, 10) || 60 * 1000;

const questionRateLimiter = rateLimit({
    windowMs: OPENAI_RATE_WINDOW,
    max: OPENAI_RATE_LIMIT,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        const resetIn = req.rateLimit && req.rateLimit.resetTime
            ? Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000)
            : Math.ceil(OPENAI_RATE_WINDOW / 1000);
        res.set('Retry-After', resetIn.toString());
        return res.status(429).json({
            error: 'Rate limit exceeded',
            details: `OpenAI rate limit exceeded. Please wait ${resetIn} seconds before making another OpenAI request.`,
            resetIn,
            provider: DEFAULT_PROVIDER
        });
    }
});

// GET /api/question/cache/stats - Get cache statistics
router.get('/cache/stats', async (req, res) => {
    try {
        const questionCache = require('../../services/questionCache');
        const stats = await questionCache.getCacheStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get cache stats', details: error.message });
    }
});

// POST /api/question/cache/generate - Manually generate and cache a question
router.post('/cache/generate', questionRateLimiter, async (req, res) => {
    try {
        const { className, unit } = req.body;
        if (!className) {
            return res.status(400).json({ error: 'className is required' });
        }
        const questionCache = require('../../services/questionCache');
        const result = await questionCache.generateAndStoreQuestion(className, unit || '', DEFAULT_PROVIDER);
        res.json({ success: true, message: 'Question generated and cached', data: result });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate question', details: error.message });
    }
});

// POST /api/question - Handle question and return answer
router.post('/', questionRateLimiter, async (req, res) => {
    try {
        const { className, unit, skipCache } = req.body;

        if (!className) {
            return res.status(400).json({ error: 'className is required' });
        }

        let result;

        // If skipCache is true (prefetch), use AI service directly
        if (skipCache) {
            const aiService = require('../../services/aiService');
            result = await aiService.generateAPQuestion({ className, unit });
            
            // Parse answer if it's a string
            if (typeof result.answer === 'string') {
                try {
                    result.answer = JSON.parse(result.answer);
                } catch (e) {
                    // Keep as string if parse fails
                }
            }
        } else {
            // Use question cache service which returns cached question and refreshes in background
            const questionCache = require('../../services/questionCache');
            result = await questionCache.getCachedQuestion(className, unit || '', DEFAULT_PROVIDER);
        }

        // If OpenAI returned a parsed object, stringify it for the frontend (preserves LaTeX)
        if (typeof result.answer === 'object') {
            return res.json({ 
                answer: JSON.stringify(result.answer), 
                provider: result.provider, 
                model: result.model, 
                cached: result.cached,
                questionId: result.questionId // Include S3 question ID if available
            });
        }

        // Otherwise return the raw answer string
        return res.json({ 
            answer: result.answer, 
            provider: result.provider, 
            model: result.model, 
            cached: result.cached,
            questionId: result.questionId // Include S3 question ID if available
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
});

module.exports = router;
