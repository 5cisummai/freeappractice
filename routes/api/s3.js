const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const { z } = require('zod');
const s3 = require('../../services/s3Service');

// Schemas
const uploadSchema = z.object({
  key: z.string().min(1),
  contentType: z.string().min(1),
  expiresIn: z.number().int().positive().max(604800).optional(), // up to 7 days
  bucket: z.string().min(1).optional(),
});

const downloadSchema = z.object({
  key: z.string().min(1),
  expiresIn: z.number().int().positive().max(604800).optional(),
  bucket: z.string().min(1).optional(),
});

// POST /api/s3/presign-upload
router.post('/presign-upload', async (req, res) => {
  try {
    const { key, contentType, expiresIn, bucket } = uploadSchema.parse(req.body);
    const result = await s3.getPresignedUploadUrl({ key, contentType, expiresIn, bucket });
    res.json({ ...result, key, bucket: bucket || process.env.AWS_S3_BUCKET });
  } catch (err) {
    logger.warn('presign-upload validation/error', { message: err.message });
    res.status(400).json({ error: err.message });
  }
});

// POST /api/s3/presign-download
router.post('/presign-download', async (req, res) => {
  try {
    const { key, expiresIn, bucket } = downloadSchema.parse(req.body);
    const result = await s3.getPresignedDownloadUrl({ key, expiresIn, bucket });
    res.json({ ...result, key, bucket: bucket || process.env.AWS_S3_BUCKET });
  } catch (err) {
    logger.warn('presign-download validation/error', { message: err.message });
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
