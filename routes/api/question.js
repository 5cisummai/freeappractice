const express = require('express');
const router = express.Router();

// Rate limiting for OpenAI requests
const openaiRateLimits = new Map(); // Map of IP -> { count, resetTime }
const OPENAI_RATE_LIMIT = 15; // requests per minute
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in milliseconds

function checkOpenAIRateLimit(ip) {
    const now = Date.now();
    const userLimit = openaiRateLimits.get(ip);

    if (!userLimit || now > userLimit.resetTime) {
        // No existing limit or window expired - reset
        openaiRateLimits.set(ip, {
            count: 1,
            resetTime: now + RATE_LIMIT_WINDOW
        });
        return { allowed: true, remaining: OPENAI_RATE_LIMIT - 1 };
    }

    if (userLimit.count >= OPENAI_RATE_LIMIT) {
        // Rate limit exceeded
        const resetIn = Math.ceil((userLimit.resetTime - now) / 1000);
        return { 
            allowed: false, 
            remaining: 0, 
            resetIn,
            message: `OpenAI rate limit exceeded. Please wait ${resetIn} seconds before making another OpenAI request.`
        };
    }

    // Increment count
    userLimit.count++;
    return { allowed: true, remaining: OPENAI_RATE_LIMIT - userLimit.count };
}

// Cleanup old rate limit entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [ip, limit] of openaiRateLimits.entries()) {
        if (now > limit.resetTime) {
            openaiRateLimits.delete(ip);
        }
    }
}, 5 * 60 * 1000);

// Provider configuration
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
router.post('/', async (req, res) => {
    try {
        const { className, unit, skipCache } = req.body;

        if (!className) {
            return res.status(400).json({ error: 'className is required' });
        }

        const provider = DEFAULT_PROVIDER;
        const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
        const rateLimitCheck = checkOpenAIRateLimit(clientIp);
        
        if (!rateLimitCheck.allowed) {
            return res.status(429).json({ 
                error: 'Rate limit exceeded',
                details: rateLimitCheck.message,
                resetIn: rateLimitCheck.resetIn,
                provider
            });
        }
        
        // Add rate limit headers
        res.set({
            'X-RateLimit-Limit': OPENAI_RATE_LIMIT,
            'X-RateLimit-Remaining': rateLimitCheck.remaining,
            'X-RateLimit-Reset': Math.ceil(Date.now() / 1000) + 60
        });

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
