import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface IReferral extends Document {
	referrerUserId: string;
	referredUserId: string;
	activatedAt?: Date;
	createdAt: Date;
	updatedAt: Date;
}

const referralSchema = new Schema<IReferral>(
	{
		referrerUserId: { type: String, required: true, index: true },
		referredUserId: { type: String, required: true, unique: true, index: true },
		activatedAt: { type: Date }
	},
	{ timestamps: true }
);

referralSchema.index({ referrerUserId: 1, activatedAt: 1 });

export const Referral: Model<IReferral> =
	(mongoose.models.Referral as Model<IReferral>) ??
	mongoose.model<IReferral>('Referral', referralSchema);
