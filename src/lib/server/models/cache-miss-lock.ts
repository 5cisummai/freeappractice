import mongoose, { Schema, type Document, type Model } from 'mongoose';

/**
 * Distributed lock for cache-miss live generation across serverless instances.
 * One document per lock key; deleted when the leader finishes or TTL expires.
 */
export interface ICacheMissLock extends Document {
	key: string;
	/** MongoDB TTL: document removed shortly after this time passes. */
	expiresAt: Date;
}

const cacheMissLockSchema = new Schema<ICacheMissLock>(
	{
		key: { type: String, required: true, unique: true },
		expiresAt: { type: Date, required: true }
	},
	{ timestamps: false }
);

// TTL: remove stale locks when leaders crash or instances are killed mid-request
cacheMissLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const CacheMissLock: Model<ICacheMissLock> =
	(mongoose.models.CacheMissLock as Model<ICacheMissLock>) ??
	mongoose.model<ICacheMissLock>('CacheMissLock', cacheMissLockSchema);
