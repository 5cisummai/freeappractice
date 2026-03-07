const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const questionStorageService = require('../services/questionStorageService');
const logger = require('../utils/logger');
const { generateRandomToken } = require('../utils/cryptoToken');
const { sendConfirmationEmail, sendResetEmail } = require('../services/emailService');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = '14d';
const PENDING_SIGNUP_TOKEN_EXPIRY = '30m';
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function createPendingSignupToken(userId, email) {
    return jwt.sign(
        {
            userId,
            email,
            purpose: 'pending_signup'
        },
        JWT_SECRET,
        { expiresIn: PENDING_SIGNUP_TOKEN_EXPIRY }
    );
}

const register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required' });
        }

        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email address' });
        }

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const emailToken = generateRandomToken();
        const emailTokenExpires = Date.now() + 24 * 60 * 60 * 1000;

        const user = new User({
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            verified: false,
            emailToken,
            emailTokenExpires
        });

        await user.save();
        await sendConfirmationEmail(user.email, emailToken);

        const pendingSignupToken = createPendingSignupToken(user._id.toString(), user.email);

        const token = jwt.sign(
            { userId: user._id.toString() },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRY }
        );

        res.status(201).json({
            message: 'User registered successfully. Please verify your email before logging in.',
            token,
            pendingSignupToken,
            user: {
                userId: user._id,
                name: user.name,
                email: user.email
            }
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Registration failed' });
    }
};

const verifyEmail = async (req, res) => {
    try {
        const { token } = req.query;

        if (!token || typeof token !== 'string') {
            return res.status(400).json({ error: 'Verification token is required' });
        }

        const user = await User.findOne({
            emailToken: { $eq: token },
            emailTokenExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired verification token' });
        }

        user.verified = true;
        user.emailToken = null;
        user.emailTokenExpires = null;

        await user.save();

        const jwtToken = jwt.sign(
            { userId: user._id.toString() },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRY }
        );

        res.json({
            message: 'Email verified successfully. You are now logged in.',
            token: jwtToken,
            user: {
                userId: user._id,
                name: user.name,
                email: user.email
            }
        });
    } catch (err) {
        console.error('Email verification error:', err);
        res.status(500).json({ error: 'Email verification failed' });
    }
};

const updateVerificationEmail = async (req, res) => {
    try {
        const { pendingSignupToken, newEmail } = req.body;

        if (!pendingSignupToken || typeof pendingSignupToken !== 'string') {
            return res.status(401).json({
                error: 'Invalid pending signup token',
                code: 'INVALID_PENDING_TOKEN'
            });
        }

        if (!newEmail || typeof newEmail !== 'string') {
            return res.status(400).json({ error: 'New email is required' });
        }

        const normalizedEmail = newEmail.trim().toLowerCase();
        if (!emailRegex.test(normalizedEmail)) {
            return res.status(400).json({ error: 'Invalid email address' });
        }

        let decoded;
        try {
            decoded = jwt.verify(pendingSignupToken, JWT_SECRET);
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({
                    error: 'Pending signup token has expired',
                    code: 'PENDING_TOKEN_EXPIRED'
                });
            }
            return res.status(401).json({
                error: 'Invalid pending signup token',
                code: 'INVALID_PENDING_TOKEN'
            });
        }

        if (!decoded || decoded.purpose !== 'pending_signup' || !decoded.userId) {
            return res.status(401).json({
                error: 'Invalid pending signup token',
                code: 'INVALID_PENDING_TOKEN'
            });
        }

        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({
                error: 'Invalid pending signup token',
                code: 'INVALID_PENDING_TOKEN'
            });
        }

        if (user.verified) {
            return res.status(409).json({
                error: 'User is already verified',
                code: 'USER_ALREADY_VERIFIED'
            });
        }

        const existingUser = await User.findOne({
            email: normalizedEmail,
            _id: { $ne: user._id }
        });

        if (existingUser) {
            return res.status(409).json({
                error: 'Email is already registered',
                code: 'EMAIL_TAKEN'
            });
        }

        const emailToken = generateRandomToken();
        const emailTokenExpires = Date.now() + 24 * 60 * 60 * 1000;

        user.email = normalizedEmail;
        user.emailToken = emailToken;
        user.emailTokenExpires = emailTokenExpires;
        await user.save();

        await sendConfirmationEmail(user.email, emailToken);

        const rotatedPendingSignupToken = createPendingSignupToken(user._id.toString(), user.email);

        res.json({
            message: 'Verification email sent to updated address',
            pendingSignupToken: rotatedPendingSignupToken,
            email: user.email
        });
    } catch (err) {
        logger.error('Update verification email error', { error: err.message });
        res.status(500).json({ error: 'Failed to update verification email' });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        if (!user.verified) {
            return res.status(403).json({ error: 'Email not verified. Please check your inbox.' });
        }

        const token = jwt.sign(
            { userId: user._id.toString() },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRY }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                userId: user._id,
                name: user.name,
                email: user.email
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
};

const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(200).json({ message: 'If that email is registered, a reset link has been sent.' });
        }

        const resetToken = generateRandomToken();
        const resetTokenExpires = Date.now() + 60 * 60 * 1000;

        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = resetTokenExpires;

        await user.save();
        await sendResetEmail(user.email, resetToken);

        res.json({ message: 'If that email is registered, a reset link has been sent.' });
    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ error: 'Failed to initiate password reset' });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token and new password are required' });
        }

        if (typeof token !== 'string' || token.trim() === '') {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        const user = await User.findOne({
            resetPasswordToken: { $eq: token },
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;

        await user.save();

        res.json({ message: 'Password has been reset successfully.' });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ error: 'Failed to reset password' });
    }
};

const getCurrentUser = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            user: {
                userId: user._id,
                name: user.name,
                email: user.email,
                createdAt: user.createdAt
            }
        });
    } catch (err) {
        console.error('Current user error:', err);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
};

const logout = (req, res) => {
    res.json({ message: 'Logged out successfully' });
};

const recordAttempt = async (req, res) => {
    try {
        const { questionId: existingQuestionId, apClass, unit, selectedAnswer, wasCorrect, timeTakenMs } = req.body;

        if (!apClass || !unit || !selectedAnswer || typeof wasCorrect !== 'boolean') {
            return res.status(400).json({
                error: 'Missing required fields: apClass, unit, selectedAnswer, wasCorrect'
            });
        }

        if (!existingQuestionId) {
            return res.status(400).json({
                error: 'questionId is required (questions are auto-saved during generation)'
            });
        }

        const questionId = existingQuestionId;

        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.questionHistory.push({
            questionId,
            apClass,
            unit,
            selectedAnswer,
            wasCorrect,
            timeTakenMs: timeTakenMs || 0,
            attemptedAt: new Date()
        });

        let progressEntry = user.progress.find(p => p.apClass === apClass && p.unit === unit);

        if (!progressEntry) {
            progressEntry = {
                apClass,
                unit,
                completed: false,
                mastery: 0,
                totalAttempts: 0,
                correctAttempts: 0
            };
            user.progress.push(progressEntry);
        }

        progressEntry.totalAttempts++;
        if (wasCorrect) {
            progressEntry.correctAttempts++;
        }
        progressEntry.mastery = Math.round((progressEntry.correctAttempts / progressEntry.totalAttempts) * 100);
        progressEntry.lastAttemptAt = new Date();

        await user.save();

        logger.info('Question attempt recorded', {
            userId: req.userId,
            questionId,
            apClass,
            unit,
            wasCorrect
        });

        res.json({
            message: 'Attempt recorded successfully',
            questionId,
            mastery: progressEntry.mastery,
            totalAttempts: progressEntry.totalAttempts
        });
    } catch (err) {
        logger.error('Record attempt error', { error: err.message, userId: req.userId });
        res.status(500).json({ error: 'Failed to record attempt' });
    }
};

const getHistory = async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;

        const user = await User.findById(req.userId).select('questionHistory');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const history = user.questionHistory
            .sort((a, b) => b.attemptedAt - a.attemptedAt)
            .slice(parseInt(offset, 10), parseInt(offset, 10) + parseInt(limit, 10));

        const questionIds = history.map(h => h.questionId);
        const questions = await questionStorageService.getQuestionsFromS3(questionIds);

        const historyWithQuestions = history.map(h => {
            const question = questions.find(q => q.id === h.questionId);
            return {
                ...h.toObject(),
                question: question || null
            };
        });

        res.json({
            history: historyWithQuestions,
            total: user.questionHistory.length
        });
    } catch (err) {
        logger.error('Get history error', { error: err.message, userId: req.userId });
        res.status(500).json({ error: 'Failed to fetch history' });
    }
};

const getProgress = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('progress');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ progress: user.progress });
    } catch (err) {
        logger.error('Get progress error', { error: err.message, userId: req.userId });
        res.status(500).json({ error: 'Failed to fetch progress' });
    }
};

const toggleBookmark = async (req, res) => {
    try {
        const { questionId } = req.body;

        if (!questionId) {
            return res.status(400).json({ error: 'questionId is required' });
        }

        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const index = user.bookmarkedQuestions.indexOf(questionId);
        if (index > -1) {
            user.bookmarkedQuestions.splice(index, 1);
        } else {
            user.bookmarkedQuestions.push(questionId);
        }

        await user.save();

        res.json({
            message: index > -1 ? 'Bookmark removed' : 'Bookmark added',
            bookmarked: index === -1
        });
    } catch (err) {
        logger.error('Bookmark error', { error: err.message, userId: req.userId });
        res.status(500).json({ error: 'Failed to bookmark question' });
    }
};

const getBookmarks = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('bookmarkedQuestions');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const questions = await questionStorageService.getQuestionsFromS3(user.bookmarkedQuestions);

        res.json({ bookmarks: questions });
    } catch (err) {
        logger.error('Get bookmarks error', { error: err.message, userId: req.userId });
        res.status(500).json({ error: 'Failed to fetch bookmarks' });
    }
};

const getStats = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('questionHistory createdAt');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const history = user.questionHistory || [];

        const totalQuestions = history.length;
        const correctAnswers = history.filter(q => q.wasCorrect).length;
        const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

        const totalTimeMs = history.reduce((sum, q) => sum + (q.timeTakenMs || 0), 0);
        const totalTimeHours = Math.round((totalTimeMs / 1000 / 60 / 60) * 10) / 10;

        let currentStreak = 0;
        if (history.length > 0) {
            const sortedDates = history
                .map(q => new Date(q.attemptedAt).toDateString())
                .filter((date, index, self) => self.indexOf(date) === index)
                .sort((a, b) => new Date(b) - new Date(a));

            const today = new Date().toDateString();
            const yesterday = new Date(Date.now() - 86400000).toDateString();

            if (sortedDates.includes(today) || sortedDates.includes(yesterday)) {
                currentStreak = 1;
                for (let i = 1; i < sortedDates.length; i++) {
                    const prevDate = new Date(sortedDates[i - 1]);
                    const currDate = new Date(sortedDates[i]);
                    const dayDiff = Math.floor((prevDate - currDate) / 86400000);

                    if (dayDiff === 1) {
                        currentStreak++;
                    } else {
                        break;
                    }
                }
            }
        }

        const subjectStats = {};
        history.forEach(q => {
            if (!subjectStats[q.apClass]) {
                subjectStats[q.apClass] = {
                    total: 0,
                    correct: 0,
                    totalTime: 0
                };
            }
            subjectStats[q.apClass].total++;
            if (q.wasCorrect) subjectStats[q.apClass].correct++;
            subjectStats[q.apClass].totalTime += q.timeTakenMs || 0;
        });

        const subjectBreakdown = Object.entries(subjectStats)
            .map(([subject, stats]) => ({
                subject,
                total: stats.total,
                correct: stats.correct,
                accuracy: Math.round((stats.correct / stats.total) * 100),
                avgTimeSeconds: Math.round(stats.totalTime / stats.total / 1000)
            }))
            .sort((a, b) => b.total - a.total);

        const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
        const recentHistory = history.filter(q => new Date(q.attemptedAt) >= sevenDaysAgo);
        const recentCorrect = recentHistory.filter(q => q.wasCorrect).length;
        const recentAccuracy = recentHistory.length > 0
            ? Math.round((recentCorrect / recentHistory.length) * 100)
            : 0;

        const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
        const dailyActivity = {};

        history.forEach(q => {
            const attemptDate = new Date(q.attemptedAt);
            if (attemptDate >= thirtyDaysAgo) {
                const dateKey = attemptDate.toISOString().split('T')[0];
                if (!dailyActivity[dateKey]) {
                    dailyActivity[dateKey] = { total: 0, correct: 0 };
                }
                dailyActivity[dateKey].total++;
                if (q.wasCorrect) dailyActivity[dateKey].correct++;
            }
        });

        res.json({
            overview: {
                totalQuestions,
                correctAnswers,
                accuracy,
                currentStreak,
                totalTimeHours,
                memberSince: user.createdAt
            },
            recentPerformance: {
                questionsLast7Days: recentHistory.length,
                accuracyLast7Days: recentAccuracy
            },
            subjectBreakdown,
            dailyActivity
        });
    } catch (err) {
        logger.error('Get stats error', { error: err.message, userId: req.userId });
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
};

const getDetailedProgress = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const history = user.questionHistory || [];

        const totalQuestions = history.length;
        const correctAnswers = history.filter(q => q.wasCorrect).length;
        const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
        const totalTimeMs = history.reduce((sum, q) => sum + (q.timeTakenMs || 0), 0);
        const totalTimeHours = Math.round((totalTimeMs / 1000 / 60 / 60) * 10) / 10;

        let currentStreak = 0;
        if (history.length > 0) {
            const sortedDates = history
                .map(q => new Date(q.attemptedAt).toDateString())
                .filter((date, index, self) => self.indexOf(date) === index)
                .sort((a, b) => new Date(b) - new Date(a));

            const today = new Date().toDateString();
            const yesterday = new Date(Date.now() - 86400000).toDateString();

            if (sortedDates.includes(today) || sortedDates.includes(yesterday)) {
                currentStreak = 1;
                for (let i = 1; i < sortedDates.length; i++) {
                    const prevDate = new Date(sortedDates[i - 1]);
                    const currDate = new Date(sortedDates[i]);
                    const dayDiff = Math.floor((prevDate - currDate) / 86400000);

                    if (dayDiff === 1) {
                        currentStreak++;
                    } else {
                        break;
                    }
                }
            }
        }

        res.json({
            user: {
                userId: user._id,
                name: user.name,
                email: user.email,
                createdAt: user.createdAt
            },
            stats: {
                totalQuestions,
                correctAnswers,
                accuracy,
                currentStreak,
                totalTimeHours
            },
            questionHistory: history,
            progress: user.progress,
            bookmarkedQuestions: user.bookmarkedQuestions
        });
    } catch (err) {
        logger.error('Get detailed progress error', { error: err.message, userId: req.userId });
        res.status(500).json({ error: 'Failed to fetch detailed progress' });
    }
};

const deleteAccount = async (req, res) => {
    try {
        const deletedUser = await User.findByIdAndDelete(req.userId);

        if (!deletedUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        logger.info('User account deleted', { userId: req.userId, email: deletedUser.email });

        res.json({ message: 'Account deleted successfully' });
    } catch (err) {
        logger.error('Delete account error', { error: err.message, userId: req.userId });
        res.status(500).json({ error: 'Failed to delete account' });
    }
};

module.exports = {
    register,
    verifyEmail,
    updateVerificationEmail,
    login,
    forgotPassword,
    resetPassword,
    getCurrentUser,
    logout,
    recordAttempt,
    getHistory,
    getProgress,
    toggleBookmark,
    getBookmarks,
    getStats,
    getDetailedProgress,
    deleteAccount
};
