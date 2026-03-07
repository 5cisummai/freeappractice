const express = require('express');
const router = express.Router();
const tutorController = require('../../controllers/tutorController');

router.post('/greeting', tutorController.getGreeting);
router.post('/chat', tutorController.chatWithTutor);

module.exports = router;
