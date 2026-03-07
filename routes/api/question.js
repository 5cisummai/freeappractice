const express = require('express');
const router = express.Router();
const questionController = require('../../controllers/questionController');

router.get('/cache/stats', questionController.getCacheStats);
router.post('/cache/generate', questionController.generateCachedQuestion);
router.post('/', questionController.generateQuestion);

module.exports = router;
