const express = require('express');
const router = express.Router();
const s3Controller = require('../../controllers/s3Controller');

router.post('/presign-upload', s3Controller.presignUpload);
router.post('/presign-download', s3Controller.presignDownload);

module.exports = router;
