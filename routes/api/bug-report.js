const express = require('express');
const router = express.Router();
const bugReportController = require('../../controllers/bugReportController');

router.post('/', bugReportController.createBugReport);

module.exports = router;
