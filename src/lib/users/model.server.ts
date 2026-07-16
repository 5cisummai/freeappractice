import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { randomBytes } from 'node:crypto';
import type {
	IPracticeExperimentAssignment,
	IProgress,
	IQuestionAttempt
} from '$lib/users/records.server';

export function createReferralCode(): string {
	return randomBytes(9).toString('base64url');
}

export interface IUserProfile extends Document {
	userId: string;
	referralCode?: string;
	progress: IProgress[];
	questionHistory: IQuestionAttempt[];
	bookmarkedQuestions: string[];
	practiceExperiments?: IPracticeExperimentAssignment[];
	createdAt: Date;
	updatedAt: Date;
}

const progressSchema = new Schema<IProgress>(
	{
		apClass: { type: String, required: true, trim: true },
		unit: { type: String, required: true, trim: true },
		completed: { type: Boolean, default: false },
		mastery: { type: Number, min: 0, max: 100, default: 0 },
		totalAttempts: { type: Number, default: 0 },
		correctAttempts: { type: Number, default: 0 },
		lastAttemptAt: { type: Date },
		lastReviewedAt: { type: Date }
	},
	{ _id: false }
);

const questionAttemptSchema = new Schema<IQuestionAttempt>(
	{
		questionId: { type: String, required: true, index: true },
		apClass: { type: String, required: true, trim: true },
		unit: { type: String, required: true, trim: true },
		selectedAnswer: { type: String, enum: ['A', 'B', 'C', 'D'] },
		wasCorrect: { type: Boolean },
		timeTakenMs: { type: Number, min: 0 },
		attemptedAt: { type: Date, default: Date.now },
		finalAnswer: { type: String, enum: ['A', 'B', 'C', 'D'] },
		answerCount: { type: Number, min: 0, max: 3 },
		hintsShown: { type: Number, min: 0, max: 2 },
		terminalOutcome: { type: String, enum: ['correct', 'revealed', 'max_attempts'] },
		experimentKey: { type: String },
		experimentVersion: { type: Number },
		displayedVariant: { type: String, enum: ['control', 'multi_attempt_hints'] }
	},
	{ _id: false }
);

const practiceExperimentSchema = new Schema<IPracticeExperimentAssignment>(
	{
		key: { type: String, required: true },
		version: { type: Number, required: true },
		variant: { type: String, enum: ['control', 'multi_attempt_hints'], required: true }
	},
	{ _id: false }
);

const userProfileSchema = new Schema<IUserProfile>(
	{
		userId: { type: String, required: true, unique: true, index: true },
		referralCode: {
			type: String,
			required: true,
			unique: true,
			sparse: true,
			default: createReferralCode
		},
		progress: { type: [progressSchema], default: [] },
		questionHistory: { type: [questionAttemptSchema], default: [] },
		bookmarkedQuestions: { type: [String], default: [] },
		practiceExperiments: { type: [practiceExperimentSchema], default: [] }
	},
	{ timestamps: true }
);

userProfileSchema.index({ 'progress.apClass': 1, 'progress.unit': 1 });
userProfileSchema.index({ 'questionHistory.attemptedAt': -1 });

export const UserProfile: Model<IUserProfile> =
	(mongoose.models.UserProfile as Model<IUserProfile>) ??
	mongoose.model<IUserProfile>('UserProfile', userProfileSchema);
