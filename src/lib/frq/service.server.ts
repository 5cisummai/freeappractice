import { env } from '$env/dynamic/private';
import { GENERATION_MODEL } from '$lib/ai/service.server';
import { FrqQuestionModel, type IFrqQuestion } from '$lib/frq/model.server';
import {
	FrqQuestionSchema,
	toPublicFrqQuestion,
	type FrqQuestion,
	type PublicFrqQuestion
} from '$lib/frq/types';
import {
	createQuestionPool,
	type GetQuestionOptions,
	type PoolSelectionResult
} from '$lib/questions/pool.server';
import { requestPoolRefill } from '$lib/questions/pool-refill-queue.server';
import { normalizeUnit } from '$lib/questions/util.server';

type FrqServiceResult = {
	question: FrqQuestion;
	publicQuestion: PublicFrqQuestion;
	provider: string;
	model: string;
	questionId: string;
	cached: boolean;
};

const FRQ_PROJECTION = {
	s3QuestionId: 1,
	schemaVersion: 1,
	formatId: 1,
	profileVersion: 1,
	promptVersion: 1,
	rubricVersion: 1,
	prompt: 1,
	materials: 1,
	sections: 1,
	rubric: 1,
	totalPoints: 1,
	topicsCovered: 1,
	apClass: 1,
	unit: 1
} as const;

function questionFromDoc(doc: IFrqQuestion): FrqQuestion {
	return FrqQuestionSchema.parse({
		schemaVersion: doc.schemaVersion,
		formatId: doc.formatId,
		profileVersion: doc.profileVersion,
		promptVersion: doc.promptVersion,
		rubricVersion: doc.rubricVersion,
		prompt: doc.prompt,
		materials: doc.materials,
		sections: doc.sections,
		rubric: doc.rubric,
		totalPoints: doc.totalPoints,
		topicsCovered: doc.topicsCovered,
		apClass: doc.apClass,
		unit: doc.unit
	});
}

const frqPool = createQuestionPool<IFrqQuestion, FrqServiceResult>({
	questionType: 'frq',
	logScope: 'frq-pool',
	normalizeUnit,
	model: FrqQuestionModel,
	projection: { ...FRQ_PROJECTION },
	serveCached: (doc) => {
		const question = questionFromDoc(doc);
		return {
			question,
			publicQuestion: toPublicFrqQuestion(doc.s3QuestionId, question),
			provider: 'cache',
			model: 'cached',
			questionId: doc.s3QuestionId,
			cached: true
		};
	},
	requestRefill: (apClass, unit) =>
		requestPoolRefill({ questionType: 'frq', apClass, unit })
});

/** Selection-only FRQ serve. Never invokes LLM or S3 generation. */
export async function getFrqQuestion(
	apClass: string,
	unit?: string,
	options?: GetQuestionOptions
): Promise<
	PoolSelectionResult<Omit<FrqServiceResult, 'question'> & { question?: FrqQuestion }>
> {
	const outcome = await frqPool.getQuestion(apClass, unit, options);
	if (outcome.status !== 'found') return outcome;
	return {
		status: 'found',
		exclusionsReset: outcome.exclusionsReset,
		result: {
			publicQuestion: outcome.result.publicQuestion,
			provider: outcome.result.provider,
			model: outcome.result.model,
			questionId: outcome.result.questionId,
			cached: outcome.result.cached
		}
	};
}

export function getFrqGradingModel(): string {
	return env.FRQ_GRADING_MODEL?.trim() || GENERATION_MODEL;
}
