import mongoose, { Schema, type Document, type Model } from 'mongoose';

/** Rolling log of recently generated topics for LLM diversity prompts. */
export interface IQuestionRecentTopic extends Document {
	apClass: string;
	unit: string;
	topicsCovered: string;
	s3QuestionId?: string;
	createdAt: Date;
}

const recentTopicSchema = new Schema<IQuestionRecentTopic>(
	{
		apClass: { type: String, required: true },
		unit: { type: String, required: true },
		topicsCovered: { type: String, required: true },
		s3QuestionId: { type: String }
	},
	{ timestamps: { createdAt: true, updatedAt: false } }
);

recentTopicSchema.index({ apClass: 1, unit: 1, createdAt: -1 });

export const QuestionRecentTopic: Model<IQuestionRecentTopic> =
	(mongoose.models.QuestionRecentTopic as Model<IQuestionRecentTopic>) ??
	mongoose.model<IQuestionRecentTopic>('QuestionRecentTopic', recentTopicSchema);
