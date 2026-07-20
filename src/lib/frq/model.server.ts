import mongoose, { Schema, type Document, type Model } from 'mongoose';
import type { FrqGrade, FrqMaterial, FrqRubricCriterion, FrqSection } from '$lib/frq/types';

export interface IFrqQuestion extends Document {
	apClass: string;
	unit: string;
	formatId: string;
	profileVersion: string;
	promptVersion: string;
	rubricVersion: string;
	schemaVersion: 1;
	prompt: string;
	materials: FrqMaterial[];
	sections: FrqSection[];
	rubric: FrqRubricCriterion[];
	totalPoints: number;
	topicsCovered: string;
	contentHash: string;
	s3QuestionId: string;
	/** Stable random pivot for indexed selection; assigned once at insert/backfill. */
	randomKey: number;
	/** Soft-active flag — quality rejection / rotation without deleting S3 history. */
	active: boolean;
	createdAt: Date;
	updatedAt: Date;
}

/** Assign a one-time random pivot in [0, 1). */
export function newFrqPoolRandomKey(): number {
	return Math.random();
}

export interface IFrqRecentTopic extends Document {
	apClass: string;
	unit: string;
	topicsCovered: string;
	s3QuestionId: string;
	createdAt: Date;
}

export interface IFrqAttempt extends Document {
	userId: string;
	submissionId: string;
	questionId: string;
	apClass: string;
	unit: string;
	formatId: string;
	responses: Record<string, string>;
	status: 'grading' | 'graded';
	grade?: FrqGrade;
	timeTakenMs: number;
	profileVersion: string;
	rubricVersion: string;
	promptVersion: string;
	gradingModel?: string;
	createdAt: Date;
	updatedAt: Date;
}

const materialSchema = new Schema<FrqMaterial>(
	{
		id: { type: String, required: true },
		title: { type: String },
		content: { type: String, required: true }
	},
	{ _id: false }
);

const sectionSchema = new Schema<FrqSection>(
	{
		id: { type: String, required: true },
		label: { type: String, required: true },
		prompt: { type: String, required: true },
		responseKind: { type: String, enum: ['text'], required: true },
		maxPoints: { type: Number, required: true }
	},
	{ _id: false }
);

const rubricLevelSchema = new Schema(
	{
		points: { type: Number, required: true },
		description: { type: String, required: true }
	},
	{ _id: false }
);

const rubricCriterionSchema = new Schema<FrqRubricCriterion>(
	{
		id: { type: String, required: true },
		sectionId: { type: String, required: true },
		label: { type: String, required: true },
		maxPoints: { type: Number, required: true },
		levels: { type: [rubricLevelSchema], required: true },
		referenceAnswer: { type: String, required: true }
	},
	{ _id: false }
);

const frqQuestionSchema = new Schema<IFrqQuestion>(
	{
		apClass: { type: String, required: true },
		unit: { type: String, required: true },
		formatId: { type: String, required: true },
		profileVersion: { type: String, required: true },
		promptVersion: { type: String, required: true },
		rubricVersion: { type: String, required: true },
		schemaVersion: { type: Number, enum: [1], required: true },
		prompt: { type: String, required: true },
		materials: { type: [materialSchema], default: [] },
		sections: { type: [sectionSchema], required: true },
		rubric: { type: [rubricCriterionSchema], required: true },
		totalPoints: { type: Number, required: true },
		topicsCovered: { type: String, required: true },
		contentHash: { type: String, required: true },
		s3QuestionId: { type: String, required: true },
		randomKey: { type: Number, required: true, default: newFrqPoolRandomKey },
		active: { type: Boolean, required: true, default: true }
	},
	{ timestamps: true }
);

frqQuestionSchema.index({ apClass: 1, unit: 1, createdAt: 1 });
frqQuestionSchema.index({ apClass: 1, unit: 1, active: 1, randomKey: 1 });
frqQuestionSchema.index({ contentHash: 1 }, { unique: true });
frqQuestionSchema.index({ s3QuestionId: 1 }, { unique: true });

const frqRecentTopicSchema = new Schema<IFrqRecentTopic>(
	{
		apClass: { type: String, required: true },
		unit: { type: String, required: true },
		topicsCovered: { type: String, required: true },
		s3QuestionId: { type: String, required: true }
	},
	{ timestamps: { createdAt: true, updatedAt: false } }
);

frqRecentTopicSchema.index({ apClass: 1, unit: 1, createdAt: -1 });

const criterionGradeSchema = new Schema(
	{
		criterionId: { type: String, required: true },
		sectionId: { type: String, required: true },
		label: { type: String, required: true },
		points: { type: Number, required: true },
		pointsAvailable: { type: Number, required: true },
		evidence: { type: String, default: '' },
		feedback: { type: String, required: true }
	},
	{ _id: false }
);

const gradeSchema = new Schema(
	{
		criteria: { type: [criterionGradeSchema], required: true },
		pointsEarned: { type: Number, required: true },
		pointsAvailable: { type: Number, required: true },
		percentage: { type: Number, required: true },
		overallFeedback: { type: String, required: true }
	},
	{ _id: false }
);

const frqAttemptSchema = new Schema<IFrqAttempt>(
	{
		userId: { type: String, required: true, index: true },
		submissionId: { type: String, required: true },
		questionId: { type: String, required: true, index: true },
		apClass: { type: String, required: true },
		unit: { type: String, required: true },
		formatId: { type: String, required: true },
		responses: { type: Schema.Types.Mixed, required: true },
		status: { type: String, enum: ['grading', 'graded'], required: true },
		grade: { type: gradeSchema },
		timeTakenMs: { type: Number, required: true, min: 0 },
		profileVersion: { type: String, required: true },
		rubricVersion: { type: String, required: true },
		promptVersion: { type: String, required: true },
		gradingModel: { type: String }
	},
	{ timestamps: true }
);

frqAttemptSchema.index({ userId: 1, submissionId: 1 }, { unique: true });
frqAttemptSchema.index({ userId: 1, createdAt: -1 });
frqAttemptSchema.index({ userId: 1, apClass: 1, unit: 1, createdAt: -1 });

export const FrqQuestionModel: Model<IFrqQuestion> =
	(mongoose.models.FrqQuestion as Model<IFrqQuestion>) ??
	mongoose.model<IFrqQuestion>('FrqQuestion', frqQuestionSchema);

export const FrqRecentTopic: Model<IFrqRecentTopic> =
	(mongoose.models.FrqRecentTopic as Model<IFrqRecentTopic>) ??
	mongoose.model<IFrqRecentTopic>('FrqRecentTopic', frqRecentTopicSchema);

export const FrqAttempt: Model<IFrqAttempt> =
	(mongoose.models.FrqAttempt as Model<IFrqAttempt>) ??
	mongoose.model<IFrqAttempt>('FrqAttempt', frqAttemptSchema);
