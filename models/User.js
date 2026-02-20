const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Subdocument schema for per-class/unit progress tracking
const progressSchema = new Schema({
    apClass: { type: String, required: true, trim: true },
    unit: { type: String, required: true, trim: true },
    completed: { type: Boolean, default: false },
    mastery: { type: Number, min: 0, max: 100, default: 0 },
    totalAttempts: { type: Number, default: 0 },
    correctAttempts: { type: Number, default: 0 },
    lastAttemptAt: { type: Date },
    lastReviewedAt: { type: Date }
}, { _id: false });

// Subdocument schema for per-question attempt history
// Note: question is now a string ID (S3 key) instead of ObjectId
const questionAttemptSchema = new Schema({
    questionId: { type: String, required: true, index: true }, // S3 question ID
    apClass: { type: String, required: true, trim: true },
    unit: { type: String, required: true, trim: true },
    selectedAnswer: { type: String, enum: ['A', 'B', 'C', 'D'], required: true },
    wasCorrect: { type: Boolean, required: true },
    timeTakenMs: { type: Number, min: 0 },
    attemptedAt: { type: Date, default: Date.now }
}, { _id: false });

const userSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true
    },
    password: {
        type: String,
        required: true
    },
    
    verified: {
        type: Boolean,
        default: false
    },
    emailToken: {
        type: String
    },
    emailTokenExpires: {
        type: Date
    },
    resetPasswordToken: {
        type: String
    },
    resetPasswordExpires: {
        type: Date
    },

    // Progress tracking per AP class and unit
    progress: { type: [progressSchema], default: [] },
    // Question attempt history
    questionHistory: { type: [questionAttemptSchema], default: [] },
    // Bookmarked questions for review later (stored as S3 question IDs)
    bookmarkedQuestions: { type: [String], default: [] }
}, 
{ timestamps: true });

// Helpful indexes for progress lookups
userSchema.index({ 'progress.apClass': 1, 'progress.unit': 1 });
userSchema.index({ 'questionHistory.attemptedAt': -1 });

module.exports = mongoose.model('User', userSchema);
