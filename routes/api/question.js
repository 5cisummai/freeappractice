const express = require('express');
// Global API rate limiting is configured in server.js.  We no longer apply
// per-route or OpenAI-specific limits here – the express-rate-limit middleware
// attached at `/api/` handles all endpoints and can be driven by environment
// variables.
const router = express.Router();

const DEFAULT_PROVIDER = 'openai';


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
router.post('/cache/generate', async (req, res) => {
    try {
        const { className, unit } = req.body;
        if (typeof className !== 'string' || !className.trim()) {
            return res.status(400).json({ error: 'className is required and must be a non-empty string' });
        }
        if (unit !== undefined && typeof unit !== 'string') {
            return res.status(400).json({ error: 'unit must be a string if provided' });
        }
        const questionCache = require('../../services/questionCache');
        const result = await questionCache.generateAndStoreQuestion(className.trim(), unit || '', DEFAULT_PROVIDER);
        res.json({ success: true, message: 'Question generated and cached', data: result });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate question', details: error.message });
    }
});

// POST /api/question - Handle question and return answer
router.post('/', async (req, res) => {
    try {
        const { className, unit, skipCache } = req.body;

        if (typeof className !== 'string' || !className.trim()) {
            return res.status(400).json({ error: 'className is required and must be a non-empty string' });
        }
        if (unit !== undefined && typeof unit !== 'string') {
            return res.status(400).json({ error: 'unit must be a string if provided' });
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
