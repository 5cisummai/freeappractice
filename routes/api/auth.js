const express = require('express');
const router = express.Router();
const verifyToken = require('../../middleware/verifyAuth');
const authController = require('../../controllers/authController');

router.post('/register', authController.register);
router.get('/verify-email', authController.verifyEmail);
router.post('/verification/update-email', authController.updateVerificationEmail);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.get('/current-user', verifyToken, authController.getCurrentUser);
router.post('/logout', verifyToken, authController.logout);
router.post('/record-attempt', verifyToken, authController.recordAttempt);
router.get('/history', verifyToken, authController.getHistory);
router.get('/progress', verifyToken, authController.getProgress);
router.post('/bookmark', verifyToken, authController.toggleBookmark);
router.get('/bookmarks', verifyToken, authController.getBookmarks);
router.get('/stats', verifyToken, authController.getStats);
router.get('/progress-detailed', verifyToken, authController.getDetailedProgress);
router.delete('/delete-account', verifyToken, authController.deleteAccount);

module.exports = router;
