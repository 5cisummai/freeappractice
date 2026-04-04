import mongoose, { Schema, type Document, type Model } from 'mongoose';

/**
 * Tracks which questions a user has already been served.
 * Used to prevent the same user from seeing the same question twice.
 * History is capped per (user, apClass, unit) bucket by the service layer
 * so that questions can eventually be recycled once a subject is exhausted.
 */
export interface ISeenQuestion extends Document {
	userId: string;
	contentHash: string;
	apClass: string;
	unit: string;
	questionType: 'mcq' | 'frq';
	seenAt: Date;
}

const seenQuestionSchema = new Schema<ISeenQuestion>({
	userId: { type: String, required: true },
	contentHash: { type: String, required: true },
	apClass: { type: String, required: true },
	unit: { type: String, required: true },
	questionType: { type: String, enum: ['mcq', 'frq'], required: true },
	seenAt: { type: Date, default: () => new Date() }
});

// Prevent serving the exact same question hash twice to the same user
seenQuestionSchema.index({ userId: 1, contentHash: 1 }, { unique: true });
// Fast lookup of all hashes a user has seen for a given class+unit
seenQuestionSchema.index({ userId: 1, apClass: 1, unit: 1, questionType: 1 });
// TTL: automatically discard history older than 180 days so questions can recycle
seenQuestionSchema.index({ seenAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });

export const SeenQuestion: Model<ISeenQuestion> =
	(mongoose.models.SeenQuestion as Model<ISeenQuestion>) ??
	mongoose.model<ISeenQuestion>('SeenQuestion', seenQuestionSchema);
