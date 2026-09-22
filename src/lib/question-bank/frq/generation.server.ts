import { randomUUID } from 'node:crypto';
import { zodSchema } from 'ai';
import { z } from 'zod';
import { FRQ_GENERATION_MODEL } from '$lib/ai/ai-models-config';
import { structuredObject } from '$lib/ai/service.server';
import { AP_DATA } from '$lib/data/ap-data';
import {
	FRQ_SCOPE_SENTENCE,
	frqPracticeFor,
	resolveFrqPoolRequest
} from '$lib/question-bank/frq/practice';
import {
	type FrqFormatRecord,
	type FrqFixedPart,
	selectFrqFormat
} from '$lib/question-bank/frq/profiles.server';
import { createFrqQuestion, newFrqPoolRandomKey } from '$lib/question-bank/frq/model.server';
import {
	FRQ_SCHEMA_VERSION,
	FrqMaterialSchema,
	FrqQuestionSchema,
	toPublicFrqQuestion,
	type FrqPart,
	type FrqQuestion,
	type PublicFrqQuestion
} from '$lib/question-bank/frq/types';
import {
	assertNoNullCharacters,
	computeContentHash,
	isDuplicateKeyError,
	normalizeUnit
} from '$lib/question-bank/util.server';
import { getRecentTopics } from '$lib/question-bank/recent-topic.server';
import { logger } from '$lib/server/logger';

const RECENT_TOPICS_WINDOW = 20;

const stableId = z
	.string()
	.trim()
	.min(1)
	.max(80)
	.regex(/^[A-Za-z0-9._:()-]+$/);

const GeneratedFrqMaterialSchema = FrqMaterialSchema.extend({
	title: z.string().trim().min(1).max(160).nullable()
}).strict();

const GeneratedFrqPartSchema = z
	.object({
		id: stableId,
		label: z.string().trim().min(1).max(80),
		prompt: z.string().trim().min(1).max(8_000),
		earns: z.string().trim().min(1).max(4_000),
		answer: z.string().trim().min(1).max(8_000),
		points: z.number().int().min(1).max(12).nullable()
	})
	.strict();

const GeneratedFrqSchema = z
	.object({
		prompt: z.string().trim().min(1).max(12_000),
		materials: z.array(GeneratedFrqMaterialSchema).max(12),
		parts: z.array(GeneratedFrqPartSchema).min(1).max(12),
		mainTopic: z
			.string()
			.trim()
			.min(1)
			.max(240)
			.describe('The single primary topic this written-response task tests.'),
		topicsCovered: z.string().trim().min(1).max(1_000)
	})
	.strict();

type GeneratedFrq = z.infer<typeof GeneratedFrqSchema>;

export function generatedFrqJsonSchema(): ReturnType<typeof zodSchema>['jsonSchema'] {
	return zodSchema(GeneratedFrqSchema).jsonSchema;
}

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

export async function getRecentFrqTopics(apClass: string, unit: string): Promise<string[]> {
	return getRecentTopics({ kind: 'frq', apClass, unit, limit: RECENT_TOPICS_WINDOW });
}

function unitNotes(apClass: string, unit: string): string {
	const course = AP_DATA.courses.find((item) => item.name === apClass);
	const match = course?.units.find((item) => item.label === unit);
	if (!match) return '';
	const keywords = match.generation.mcq.keywords.join(', ');
	const constraints = match.generation.mcq.constraints.join('; ');
	return [
		keywords ? `Unit keywords: ${keywords}.` : '',
		constraints ? `Unit constraints: ${constraints}.` : ''
	]
		.filter(Boolean)
		.join('\n');
}

function describeFixedPart(part: FrqFixedPart): string {
	const lines = [
		`- ${part.id} (${part.label}, ${part.points} ${part.points === 1 ? 'point' : 'points'})`
	];
	if (part.prompt) lines.push(`  Student-facing prompt (fixed): ${part.prompt}`);
	if (part.earns) lines.push(`  Earns (fixed): ${part.earns}`);
	if (!part.prompt) lines.push('  You write the student-facing prompt.');
	if (!part.earns) lines.push('  You write the earns line. Points stay the stored integer.');
	return lines.join('\n');
}

export function buildFrqGenerationPrompt(
	apClass: string,
	unit: string,
	recentTopics: string[],
	formatId?: string
): { system: string; user: string; format: FrqFormatRecord } {
	const format = selectFrqFormat(apClass, formatId);
	const scope = frqPracticeFor(apClass)?.scope;
	const anchorUnit = scope === 'single-unit' || scope === 'anchor';
	const recent = recentTopics.length
		? `Avoid repeating these recently used concepts or scenarios:\n${recentTopics.map((topic) => `- ${topic}`).join('\n')}`
		: '';
	const course = AP_DATA.courses.find((item) => item.name === apClass);
	const partRules = format.parts
		? `Fixed parts:\n${format.parts.map(describeFixedPart).join('\n')}\nReturn one object per fixed part id. Do not add, drop, or renumber parts. Do not change points.`
		: `You write the parts. Each points value is a positive integer, usually 1, and the parts sum to ${format.pointTotal}. A part worth more than 1 point is only undivided work, and its earns line names point 1, point 2, and so on in order.`;
	const scopeSentence = scope ? FRQ_SCOPE_SENTENCE[scope] : '';
	const covered =
		scope === 'multi-unit' || scope === 'period'
			? 'Put the units or period you used in topicsCovered.'
			: '';
	const notes = scope === 'multi-unit' || scope === 'period' ? '' : unitNotes(apClass, unit);
	const system = [
		'You create wholly original written-response practice for an independent study application. Never copy, reconstruct, or closely imitate any identifiable exam question, passage, scoring guideline, or copyrighted source.',
		'',
		`Course: ${apClass}`,
		anchorUnit ? `Unit: ${unit}` : '',
		course?.generation.courseGuidance ?? '',
		notes,
		`Format: ${format.formatId}`,
		`Materials: ${format.materialMin === format.materialMax ? `exactly ${format.materialMin}` : `${format.materialMin} to ${format.materialMax}`}`,
		`Student response: ${format.responseMode === 'essay' ? 'one essay, scored on the fixed rows' : 'one answer box per part'}`,
		format.guidance,
		partRules,
		scopeSentence,
		covered,
		recent,
		'',
		'Return the scenario prompt, the materials, and the parts. Materials may use Markdown and $...$ or $$...$$ LaTeX. Set title to null when a material has no title. Set points to null on a fixed part. Write points only when you are choosing the parts. The private answer is grading information, not student-facing copy. Do not return a second rubric, a levels array, or a total.'
	]
		.filter((line, index, lines) => line !== '' || lines[index - 1] !== '')
		.join('\n');
	return {
		system,
		user: anchorUnit
			? `Create an original ${apClass} ${format.formatId} task for ${unit}.`
			: `Create an original ${apClass} ${format.formatId} task.`,
		format
	};
}

function earnsNamesEachPoint(earns: string, points: number): boolean {
	let from = 0;
	const text = earns.toLowerCase();
	for (let point = 1; point <= points; point += 1) {
		const token = `point ${point}`;
		const at = text.indexOf(token, from);
		if (at < 0) return false;
		from = at + token.length;
	}
	return true;
}

function assembleParts(format: FrqFormatRecord, generated: GeneratedFrq): FrqPart[] {
	if (format.parts) {
		const byId = new Map(generated.parts.map((part) => [part.id, part]));
		if (byId.size !== generated.parts.length || byId.size !== format.parts.length) {
			throw new Error('Generated FRQ parts do not match the format');
		}
		return format.parts.map((fixed) => {
			const filled = byId.get(fixed.id);
			if (!filled) throw new Error(`Generated FRQ is missing part ${fixed.id}`);
			const prompt = fixed.prompt ?? filled.prompt;
			const earns = fixed.earns ?? filled.earns;
			if (!fixed.earns && fixed.points > 1 && !earnsNamesEachPoint(earns, fixed.points)) {
				throw new Error(`Part ${fixed.id} earns line must name each point in order`);
			}
			return {
				id: fixed.id,
				label: fixed.label,
				prompt,
				points: fixed.points,
				earns,
				answer: filled.answer
			};
		});
	}

	const ids = new Set<string>();
	let sum = 0;
	const parts = generated.parts.map((part) => {
		if (part.points == null) throw new Error(`Part ${part.id} needs a point value`);
		if (ids.has(part.id)) throw new Error(`Duplicate part ID: ${part.id}`);
		ids.add(part.id);
		if (part.points > 1 && !earnsNamesEachPoint(part.earns, part.points)) {
			throw new Error(`Part ${part.id} earns line must name each point in order`);
		}
		sum += part.points;
		return {
			id: part.id,
			label: part.label,
			prompt: part.prompt,
			points: part.points,
			earns: part.earns,
			answer: part.answer
		};
	});
	if (sum !== format.pointTotal) {
		throw new Error(`Parts must sum to ${format.pointTotal}`);
	}
	return parts;
}

export function parseGeneratedFrq(
	apClass: string,
	unit: string,
	generated: unknown,
	formatId?: string
): FrqQuestion {
	const format = selectFrqFormat(apClass, formatId);
	const parsed = GeneratedFrqSchema.parse(generated);
	if (
		parsed.materials.length < format.materialMin ||
		parsed.materials.length > format.materialMax
	) {
		throw new Error('Generated FRQ does not satisfy the format material count');
	}
	const storedUnit = frqPracticeFor(apClass)?.control === 'task' ? 'All Units' : unit;
	return FrqQuestionSchema.parse({
		schemaVersion: FRQ_SCHEMA_VERSION,
		formatId: format.formatId,
		responseMode: format.responseMode,
		prompt: parsed.prompt,
		materials: parsed.materials.map(({ title, ...material }) => ({
			...material,
			...(title === null ? {} : { title })
		})),
		parts: assembleParts(format, parsed),
		mainTopic: parsed.mainTopic,
		topicsCovered: parsed.topicsCovered,
		apClass,
		unit: storedUnit
	});
}

async function generateFrq(
	apClass: string,
	unit: string,
	recentTopics: string[],
	formatId?: string
): Promise<FrqQuestion> {
	const prompt = buildFrqGenerationPrompt(apClass, unit, recentTopics, formatId);
	const { parsed } = await structuredObject({
		callName: 'generateFrqQuestion',
		model: FRQ_GENERATION_MODEL,
		system: prompt.system,
		user: prompt.user,
		schema: GeneratedFrqSchema,
		schemaName: 'frq_question',
		reasoningEffort: 'high',
		logContext: { apClass, unit, formatId: prompt.format.formatId }
	});
	return parseGeneratedFrq(apClass, unit, parsed, prompt.format.formatId);
}

async function persistFrqQuestion(
	question: FrqQuestion,
	generationMs: number,
	model: string
): Promise<FrqGenerateResult> {
	assertNoNullCharacters(question, 'generated FRQ');
	const { apClass, unit } = question;
	const persistenceStarted = Date.now();
	const questionId = randomUUID();
	const contentHash = computeContentHash(
		JSON.stringify({
			prompt: question.prompt,
			materials: question.materials,
			parts: question.parts.map((part) => ({
				id: part.id,
				prompt: part.prompt,
				answer: part.answer
			}))
		})
	);

	let skippedDuplicate = false;
	try {
		await createFrqQuestion({
			...question,
			contentHash,
			questionId,
			randomKey: newFrqPoolRandomKey(),
			active: true
		});
	} catch (error) {
		if (!isDuplicateKeyError(error)) throw error;
		skippedDuplicate = true;
		logger.info('[frq-generation] generated duplicate was not inserted into the pool', {
			apClass,
			unit,
			contentHash
		});
	}

	return {
		question,
		publicQuestion: toPublicFrqQuestion(questionId, question),
		provider: 'ai',
		model,
		questionId,
		cached: false,
		skippedDuplicate,
		timing: { generationMs, persistenceMs: Date.now() - persistenceStarted }
	};
}

export async function persistGeneratedFrqToPool(
	apClass: string,
	unit: string,
	generated: unknown,
	model = 'batch',
	formatId?: string
): Promise<FrqGenerateResult> {
	const resolved = resolveFrqPoolRequest(apClass, normalizeUnit(unit), formatId);
	return persistFrqQuestion(
		parseGeneratedFrq(apClass, resolved.storedUnit, generated, resolved.formatId),
		0,
		model
	);
}

/**
 * Worker-only: AI → Neon PostgreSQL active FRQ library.
 * Must not be imported by request-path selection modules.
 * One call uses one format record.
 */
export async function generateAndPersistFrq(
	apClass: string,
	unit: string,
	recentTopics?: string[],
	formatId?: string
): Promise<FrqGenerateResult> {
	const resolved = resolveFrqPoolRequest(apClass, normalizeUnit(unit), formatId);
	const generationStarted = Date.now();
	const topics =
		recentTopics ??
		(await getRecentFrqTopics(apClass, resolved.storedUnit).catch(() => [] as string[]));
	const question = await generateFrq(apClass, resolved.storedUnit, topics, resolved.formatId);
	const generationMs = Date.now() - generationStarted;
	return persistFrqQuestion(question, generationMs, FRQ_GENERATION_MODEL);
}
