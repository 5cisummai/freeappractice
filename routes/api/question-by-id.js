const express = require('express');
const router = express.Router();
const questionByIdController = require('../../controllers/questionByIdController');

router.get('/:id', questionByIdController.verifyQuestionAccessToken, questionByIdController.getQuestionById);

module.exports = router;
