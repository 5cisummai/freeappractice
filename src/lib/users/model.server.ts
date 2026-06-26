import mongoose, { Schema, type Document, type Model } from 'mongoose';
import type { IProgress, IQuestionAttempt } from '$lib/users/records.server';

export interface IUserProfile extends Document {
	userId: string;
	progress: IProgress[];
	questionHistory: IQuestionAttempt[];
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
		lastReviewedAt: { type: Date }
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

const userProfileSchema = new Schema<IUserProfile>(
	{
		userId: { type: String, required: true, unique: true, index: true },
		progress: { type: [progressSchema], default: [] },
		questionHistory: { type: [questionAttemptSchema], default: [] },
		bookmarkedQuestions: { type: [String], default: [] }
	},
	{ timestamps: true }
);

userProfileSchema.index({ 'progress.apClass': 1, 'progress.unit': 1 });
userProfileSchema.index({ 'questionHistory.attemptedAt': -1 });

export const UserProfile: Model<IUserProfile> =
	(mongoose.models.UserProfile as Model<IUserProfile>) ??
	mongoose.model<IUserProfile>('UserProfile', userProfileSchema);
