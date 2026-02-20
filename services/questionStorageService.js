const s3Service = require('./s3Service');
const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Generate a unique question ID
 */
function generateQuestionId() {
  return crypto.randomUUID();
}

/**
 * Save a question to S3 storage
 * @param {Object} questionData - Full question data
 * @returns {Promise<string>} - Question ID (S3 key)
 */

/**
 * Retrieve a question from S3 by ID
 * @param {string} questionId - The question ID
 * @returns {Promise<Object>} - Question data
 */
async function getQuestionFromS3(questionId) {
  try {
    const key = `questions/${questionId}.json`;
    const stream = await s3Service.getObjectStream({ key });
    
    // Convert stream to string
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    const questionData = JSON.parse(buffer.toString('utf-8'));
    
    return questionData;
  } catch (error) {
    logger.error('Failed to retrieve question from S3', { questionId, error: error.message });
    throw new Error('Question not found in S3');
  }
}

/**
 * Retrieve multiple questions from S3 by IDs
 * @param {string[]} questionIds - Array of question IDs
 * @returns {Promise<Object[]>} - Array of question data
 */
async function getQuestionsFromS3(questionIds) {
  try {
    const promises = questionIds.map(id => 
      getQuestionFromS3(id).catch(err => {
        logger.warn('Failed to retrieve question', { questionId: id, error: err.message });
        return null;
      })
    );
    
    const results = await Promise.all(promises);
    return results.filter(q => q !== null);
  } catch (error) {
    logger.error('Failed to retrieve questions from S3', { error: error.message });
    throw error;
  }
}

/**
 * List all questions for a user (paginated)
 * @param {string} userId - User ID for folder prefix
 * @param {number} maxKeys - Max results
 * @returns {Promise<string[]>} - Array of question IDs
 */
async function listUserQuestions(userId, maxKeys = 1000) {
  try {
    const prefix = `questions/users/${userId}/`;
    const objects = await s3Service.listObjects({ prefix, maxKeys });
    
    // Extract question IDs from keys
    const questionIds = objects.map(obj => {
      const match = obj.Key.match(/questions\/users\/[^/]+\/([^.]+)\.json/);
      return match ? match[1] : null;
    }).filter(Boolean);
    
    return questionIds;
  } catch (error) {
    logger.error('Failed to list user questions', { userId, error: error.message });
    return [];
  }
}

module.exports = {
  getQuestionFromS3,
  getQuestionsFromS3,
  listUserQuestions
};
