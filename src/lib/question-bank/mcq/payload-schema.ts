import { z } from 'zod';
import { resolveQuestionMainTopic } from '$lib/question-bank/main-topic';

export const McqQuestionPayloadSchema = z.object({
	apClass: z.string().trim().min(1),
	unit: z.string().trim().min(1),
	mainTopic: z.string().trim().min(1).max(240),
	topicsCovered: z.string(),
	question: z.string().min(1),
	diagramSpec: z.record(z.string(), z.unknown()).nullable(),
	hasDiagram: z.boolean(),
	optionA: z.string(),
	optionB: z.string(),
	optionC: z.string(),
	optionD: z.string(),
	correctAnswer: z.enum(['A', 'B', 'C', 'D']),
	explanation: z.string(),
	hint1: z.string().nullable(),
	hint2: z.string().nullable()
});

export type McqQuestionPayload = z.infer<typeof McqQuestionPayloadSchema>;

/** Parse a stored MCQ JSONB payload. Legacy rows without mainTopic copy topicsCovered. */
export function parseMcqQuestionPayload(data: unknown): McqQuestionPayload {
	const record = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
	const topicsCovered = String(record.topicsCovered ?? '');
	return McqQuestionPayloadSchema.parse({
		...record,
		topicsCovered,
		mainTopic:
			resolveQuestionMainTopic(
				typeof record.mainTopic === 'string' ? record.mainTopic : '',
				topicsCovered
			) || 'Legacy topic'
	});
}
