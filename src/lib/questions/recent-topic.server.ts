import { QuestionRecentTopic } from '$lib/questions/recent-topic-model.server';
import { connectDb } from '$lib/server/db';

const DEFAULT_WINDOW = 20;

export async function recordRecentTopic(opts: {
	apClass: string;
	unit: string;
	topicsCovered: string;
	s3QuestionId?: string;
}): Promise<void> {
	const topicsCovered = opts.topicsCovered.trim();
	if (!topicsCovered) return;

	await connectDb();
	await QuestionRecentTopic.create({
		apClass: opts.apClass,
		unit: opts.unit,
		topicsCovered,
		s3QuestionId: opts.s3QuestionId
	});
}

export async function getRecentTopics(
	className: string,
	unit: string,
	limit = DEFAULT_WINDOW
): Promise<string[]> {
	await connectDb();
	const docs = await QuestionRecentTopic.find(
		{ apClass: className, unit, topicsCovered: { $ne: '' } },
		{ topicsCovered: 1 },
		{ sort: { createdAt: -1 }, limit }
	).lean();
	return docs.map((d) => d.topicsCovered).filter(Boolean);
}
