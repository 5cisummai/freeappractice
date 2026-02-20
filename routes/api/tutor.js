const express = require('express');
const router = express.Router();
const tutorService = require('../../services/tutorService');

// POST /api/tutor/greeting - Get initial greeting from tutor
router.post('/greeting', async (req, res) => {
    try {
        const { question } = req.body;

        if (!question) {
            return res.status(400).json({ error: 'Question is required' });
        }

        const message = await tutorService.getGreeting(question);
        res.json({ message });
    } catch (error) {
        console.error('Tutor greeting error:', error);
        res.status(500).json({ 
            error: 'Failed to get tutor greeting',
            message: "Hi! I'm here to help you understand this question. What would you like to know?"
        });
    }
});

// POST /api/tutor/chat - Chat with the AI tutor (streaming)
router.post('/chat', async (req, res) => {
    try {
        const { question, answer, explanation, apClass, unit, answerChoices, conversationHistory, message } = req.body;

        if (!question || !message) {
            return res.status(400).json({ error: 'Question and message are required' });
        }

        // Set headers for Server-Sent Events
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        try {
            const stream = await tutorService.chat(
                question,
                answer || '',
                explanation || '',
                apClass || '',
                unit || '',
                answerChoices || null,
                conversationHistory || [],
                message
            );

            // Stream the response
            for await (const chunk of stream) {
                // Check both delta.content and message.content
                const delta = chunk.choices[0]?.delta;
                const content = delta?.content || '';
                
                if (content) {
                    res.write(`data: ${JSON.stringify({ content })}\n\n`);
                }
            }

            // Send done signal
            res.write('data: [DONE]\n\n');
            res.end();
        } catch (streamError) {
            console.error('Stream error:', streamError);
            console.error('Stream error details:', streamError.message, streamError.stack);
            // If headers already sent, can't send JSON error
            if (!res.headersSent) {
                return res.status(500).json({ 
                    error: 'Failed to get tutor response',
                    message: streamError.message
                });
            }
            res.end();
        }
    } catch (error) {
        console.error('Tutor chat error:', error);
        console.error('Error details:', error.message, error.stack);
        if (!res.headersSent) {
            res.status(500).json({ 
                error: 'Failed to get tutor response',
                message: error.message
            });
        }
    }
});

module.exports = router;
