import mongoose, { Schema, type Document, type Model } from 'mongoose';

export type PoolRefillQuestionType = 'mcq' | 'frq';

export type PoolRefillStatus = 'pending' | 'running' | 'idle' | 'failed' | 'budget_exhausted';

export interface IPoolRefillState extends Document {
	questionType: PoolRefillQuestionType;
	apClass: string;
	unit: string;
	status: PoolRefillStatus;
	target: number;
	observedCount: number;
	requestedAt: Date;
	leaseOwner?: string | null;
	leaseExpiresAt?: Date | null;
	attempts: number;
	generatedCount: number;
	lastError?: string | null;
	nextAttemptAt?: Date | null;
	lastSuccessAt?: Date | null;
	createdAt: Date;
	updatedAt: Date;
}

const poolRefillSchema = new Schema<IPoolRefillState>(
	{
		questionType: { type: String, enum: ['mcq', 'frq'], required: true },
		apClass: { type: String, required: true },
		unit: { type: String, required: true },
		status: {
			type: String,
			enum: ['pending', 'running', 'idle', 'failed', 'budget_exhausted'],
			required: true,
			default: 'pending'
		},
		target: { type: Number, required: true },
		observedCount: { type: Number, required: true, default: 0 },
		requestedAt: { type: Date, required: true, default: () => new Date() },
		leaseOwner: { type: String, default: null },
		leaseExpiresAt: { type: Date, default: null },
		attempts: { type: Number, required: true, default: 0 },
		generatedCount: { type: Number, required: true, default: 0 },
		lastError: { type: String, default: null },
		nextAttemptAt: { type: Date, default: null },
		lastSuccessAt: { type: Date, default: null }
	},
	{ timestamps: true }
);

poolRefillSchema.index({ questionType: 1, apClass: 1, unit: 1 }, { unique: true });
poolRefillSchema.index({ status: 1, nextAttemptAt: 1, leaseExpiresAt: 1 });

export const PoolRefillState: Model<IPoolRefillState> =
	(mongoose.models.PoolRefillState as Model<IPoolRefillState>) ??
	mongoose.model<IPoolRefillState>('PoolRefillState', poolRefillSchema);

/** Daily LLM generation counter for hard budget enforcement. */
export interface IPoolGenerationBudget extends Document {
	dayKey: string;
	generations: number;
	createdAt: Date;
	updatedAt: Date;
}

const poolGenerationBudgetSchema = new Schema<IPoolGenerationBudget>(
	{
		dayKey: { type: String, required: true, unique: true },
		generations: { type: Number, required: true, default: 0 }
	},
	{ timestamps: true }
);

export const PoolGenerationBudget: Model<IPoolGenerationBudget> =
	(mongoose.models.PoolGenerationBudget as Model<IPoolGenerationBudget>) ??
	mongoose.model<IPoolGenerationBudget>('PoolGenerationBudget', poolGenerationBudgetSchema);
