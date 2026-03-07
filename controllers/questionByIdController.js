const jwt = require('jsonwebtoken');
const questionStorageService = require('../services/questionStorageService');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const verifyQuestionAccessToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

const getQuestionById = async (req, res) => {
    try {
        const id = req.params.id;
        if (!id) return res.status(400).json({ error: 'Question id is required' });

        const question = await questionStorageService.getQuestionFromS3(id);
        return res.json(question);
    } catch (err) {
        return res.status(404).json({ error: 'Question not found', details: err.message });
    }
};

module.exports = {
    verifyQuestionAccessToken,
    getQuestionById
};
