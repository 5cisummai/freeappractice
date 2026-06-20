import mongoose, { Schema, type Document, type Model } from 'mongoose';
import type { IFRQAttempt, IProgress, IQuestionAttempt } from '$lib/server/models/user-records';

export interface ILegacyUser extends Document {
	name: string;
	email: string;
	password: string;
	googleId?: string | null;
	authProvider: 'local' | 'google';
	verified: boolean;
	emailToken?: string | null;
	emailTokenExpires?: Date | null;
	resetPasswordToken?: string | null;
	resetPasswordExpires?: Date | null;
	progress: IProgress[];
	questionHistory: IQuestionAttempt[];
	frqHistory: IFRQAttempt[];
	bookmarkedQuestions: string[];
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
		lastReviewedAt: { type: Date },
		frqTotalAttempts: { type: Number, default: 0 },
		frqTotalScore: { type: Number, default: 0 }
	},
	{ _id: false }
);

const questionAttemptSchema = new Schema<IQuestionAttempt>(
	{
		questionId: { type: String, required: true, index: true },
		apClass: { type: String, required: true, trim: true },
		unit: { type: String, required: true, trim: true },
		selectedAnswer: { type: String, enum: ['A', 'B', 'C', 'D'], required: true },
		wasCorrect: { type: Boolean, required: true },
		timeTakenMs: { type: Number, min: 0 },
		attemptedAt: { type: Date, default: Date.now }
	},
	{ _id: false }
);

const frqAttemptSchema = new Schema<IFRQAttempt>(
	{
		questionId: { type: String, required: true, index: true },
		apClass: { type: String, required: true, trim: true },
		unit: { type: String, required: true, trim: true },
		aiScore: { type: Number, min: 0, max: 100, required: true },
		pointsEarned: { type: Number, min: 0, required: true },
		totalPoints: { type: Number, min: 1, required: true },
		timeTakenMs: { type: Number, min: 0 },
		attemptedAt: { type: Date, default: Date.now }
	},
	{ _id: false }
);

const legacyUserSchema = new Schema<ILegacyUser>(
	{
		name: { type: String, required: true, trim: true },
		email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
		password: { type: String, default: null },
		googleId: { type: String, default: null, sparse: true, index: true },
		authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
		verified: { type: Boolean, default: false },
		emailToken: { type: String, default: null },
		emailTokenExpires: { type: Date, default: null },
		resetPasswordToken: { type: String, default: null },
		resetPasswordExpires: { type: Date, default: null },
		progress: { type: [progressSchema], default: [] },
		questionHistory: { type: [questionAttemptSchema], default: [] },
		frqHistory: { type: [frqAttemptSchema], default: [] },
		bookmarkedQuestions: { type: [String], default: [] }
	},
	{ timestamps: true }
);

legacyUserSchema.index({ 'progress.apClass': 1, 'progress.unit': 1 });
legacyUserSchema.index({ 'questionHistory.attemptedAt': -1 });
legacyUserSchema.index({ 'frqHistory.attemptedAt': -1 });

export const LegacyUser: Model<ILegacyUser> =
	(mongoose.models.User as Model<ILegacyUser>) ??
	mongoose.model<ILegacyUser>('User', legacyUserSchema);
