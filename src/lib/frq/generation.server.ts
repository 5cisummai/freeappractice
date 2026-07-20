import { z } from 'zod';
import { GENERATION_MODEL, structuredObject } from '$lib/ai/service.server';
import { getFrqCourseProfile } from '$lib/frq/profiles.server';
import { FrqQuestionModel, FrqRecentTopic, newFrqPoolRandomKey } from '$lib/frq/model.server';
import { saveFrqToS3 } from '$lib/frq/storage.server';
import {
	FRQ_SCHEMA_VERSION,
	FrqMaterialSchema,
	FrqQuestionSchema,
	FrqRubricCriterionSchema,
	FrqSectionSchema,
	toPublicFrqQuestion,
	type FrqQuestion,
	type PublicFrqQuestion
} from '$lib/frq/types';
import { computeContentHash, isDuplicateKeyError, normalizeUnit } from '$lib/questions/util.server';
import { connectDb } from '$lib/server/db';
import { logger } from '$lib/server/logger';

const PROMPT_VERSION = 'frq-generation-v1';
const RECENT_TOPICS_WINDOW = 20;

const GeneratedFrqSchema = z
	.object({
		prompt: z.string().trim().min(1).max(12_000),
		materials: z.array(FrqMaterialSchema).max(12),
		sections: z.array(FrqSectionSchema).min(1).max(12),
		rubric: z.array(FrqRubricCriterionSchema).min(1).max(30),
		totalPoints: z.number().int().min(1).max(100),
		topicsCovered: z.string().trim().min(1).max(1_000)
	})
	.strict();

export type FrqGenerateResult = {
	question: FrqQuestion;
	publicQuestion: PublicFrqQuestion;
	provider: string;
	model: string;
	questionId: string;
	cached: boolean;
	skippedDuplicate?: boolean;
	timing?: { generationMs: number; persistenceMs: number };
};

async function getRecentTopics(apClass: string, unit: string): Promise<string[]> {
	await connectDb();
	const topics = await FrqRecentTopic.find(
		{ apClass, unit },
		{ topicsCovered: 1 },
		{ sort: { createdAt: -1 }, limit: RECENT_TOPICS_WINDOW }
	).lean();
	return topics.map((topic) => topic.topicsCovered).filter(Boolean);
}

async function generateFrq(
	apClass: string,
	unit: string,
	recentTopics: string[]
): Promise<FrqQuestion> {
	const profile = getFrqCourseProfile(apClass);
	if (!profile) throw new Error('FRQ practice is not available for this course');

	const recent = recentTopics.length
		? `Avoid repeating these recently used concepts or scenarios:\n${recentTopics.map((topic) => `- ${topic}`).join('\n')}`
		: '';
	const constraints = profile.generationConstraints;
	const systemPrompt = `You create wholly original written-response practice for an independent study application. Never copy, reconstruct, or closely imitate any identifiable exam question, passage, scoring guideline, or copyrighted source.

Course: ${apClass}
Unit: ${unit}
Format: ${profile.formatId}
Supported formats: ${profile.supportedFormats.join(', ')}
Allowed response types: ${profile.allowedResponseTypes.join(', ')}
Scoring mechanics: ${profile.scoringMechanics}
Generation constraints: ${constraints.minSections}-${constraints.maxSections} sections, at most ${constraints.maxMaterials} materials, original content only.
${profile.generationGuidance}
${recent}

Return one coherent question and its private scoring rubric. Materials and prompts may use Markdown and $...$ or $$...$$ LaTeX. Every section needs one or more rubric criteria. Criterion levels must use unique integer points, include zero, and reach maxPoints. Section point totals and the overall total must exactly match the rubric. Reference answers are private grading facts, not student-facing copy.`;

	const { parsed } = await structuredObject({
		callName: 'generateFrqQuestion',
		model: GENERATION_MODEL,
		system: systemPrompt,
		user: `Create an original ${apClass} written-response task for ${unit}.`,
		schema: GeneratedFrqSchema,
		schemaName: 'frq_question',
		reasoningEffort: 'high',
		logContext: { apClass, unit, profileVersion: profile.profileVersion }
	});

	const question = FrqQuestionSchema.parse({
		...parsed,
		schemaVersion: FRQ_SCHEMA_VERSION,
		formatId: profile.formatId,
		profileVersion: profile.profileVersion,
		promptVersion: PROMPT_VERSION,
		rubricVersion: profile.rubricVersion,
		apClass,
		unit
	});
	if (
		question.sections.length < constraints.minSections ||
		question.sections.length > constraints.maxSections ||
		question.materials.length > constraints.maxMaterials ||
		question.sections.some(
			(section) => !profile.allowedResponseTypes.includes(section.responseKind)
		)
	) {
		throw new Error('Generated FRQ does not satisfy the course profile constraints');
	}
	return question;
}

/**
 * Worker-only: AI → S3 → Mongo active FRQ library.
 * Must not be imported by request-path selection modules.
 */
export async function generateAndPersistFrq(
	apClass: string,
	unit: string,
	recentTopics?: string[]
): Promise<FrqGenerateResult> {
	const cacheUnit = normalizeUnit(unit);
	const generationStarted = Date.now();
	const topics =
		recentTopics ?? (await getRecentTopics(apClass, cacheUnit).catch(() => [] as string[]));
	const question = await generateFrq(apClass, cacheUnit, topics);
	const generationMs = Date.now() - generationStarted;
	const persistenceStarted = Date.now();
	const questionId = await saveFrqToS3(question);
	const contentHash = computeContentHash(
		JSON.stringify({
			prompt: question.prompt,
			materials: question.materials,
			sections: question.sections
		})
	);

	let skippedDuplicate = false;
	try {
		await FrqQuestionModel.create({
			...question,
			contentHash,
			s3QuestionId: questionId,
			randomKey: newFrqPoolRandomKey(),
			active: true
		});
		await FrqRecentTopic.create({
			apClass,
			unit: cacheUnit,
			topicsCovered: question.topicsCovered,
			s3QuestionId: questionId
		});
	} catch (error) {
		if (!isDuplicateKeyError(error)) throw error;
		skippedDuplicate = true;
		logger.info('[frq-generation] generated duplicate was not inserted into the pool', {
			apClass,
			unit: cacheUnit,
			contentHash
		});
	}

	return {
		question,
		publicQuestion: toPublicFrqQuestion(questionId, question),
		provider: 'ai',
		model: GENERATION_MODEL,
		questionId,
		cached: false,
		skippedDuplicate,
		timing: { generationMs, persistenceMs: Date.now() - persistenceStarted }
	};
}
