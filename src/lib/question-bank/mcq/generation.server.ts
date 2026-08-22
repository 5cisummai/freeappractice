import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { UNIT_DESCRIPTIONS } from '$lib/data/ap-data';
import { MCQ_GENERATION_MODEL } from '$lib/ai/ai-models-config';
import { EXAMFIG_DIAGRAM_SKILL } from '$lib/ai/examfig-skill';
import { isExamfigDiagramsEnabled } from '$lib/flags';
import { structuredObject } from '$lib/ai/service.server';
import { examfigTools } from '$lib/ai/tools/examfig.server';
import { validateExamfigDiagram } from '$lib/ai/examfig.server';
import { assertOpenAiCompatibleObjectSchema } from '$lib/ai/openai-structured-schema';

/**
 * MCQ generation: prompts, structured AI calls, and generation metrics.
 */
interface UnitContext {
	description: string;
	topics: string[];
	keywords: string[];
}

interface UnitPromptSections {
	unitContext: string;
	keywordsContext: string;
}

function unitContextKey(apClass: string, unit: string): string {
	return `${apClass}\0${unit}`;
}

/** Exact apClass + unit label → CED context. Built once from catalog-aligned JSON. */
const unitContextByKey: ReadonlyMap<string, UnitContext> = (() => {
	const data = UNIT_DESCRIPTIONS;
	const map = new Map<string, UnitContext>();
	for (const course of data.courses ?? []) {
		for (const unit of course.units ?? []) {
			map.set(unitContextKey(course.apClass, unit.unit), {
				description: unit.description ?? '',
				topics: unit.topics ?? [],
				keywords: unit.keywords ?? []
			});
		}
	}
	return map;
})();

/** Exact lookup only - keys must match the unified app catalog class names and unit labels. */
export function getUnitContextData(className: string, unitIdentifier: string): UnitContext | null {
	if (!className || !unitIdentifier) return null;
	return unitContextByKey.get(unitContextKey(className, unitIdentifier.trim())) ?? null;
}

function buildUnitSections(
	className: string,
	unit: string | undefined,
	questionLabel = 'question'
): UnitPromptSections {
	if (!className || !unit) return { unitContext: '', keywordsContext: '' };
	const ctx = getUnitContextData(className, unit);
	if (!ctx) return { unitContext: '', keywordsContext: '' };
	return {
		unitContext: `\nUNIT FOCUS: ${unit}\n${ctx.description ? `${ctx.description}\n` : ''}${ctx.topics.length ? `MAIN TOPIC OPTIONS (choose exactly one for the required mainTopic field): ${ctx.topics.join(', ')}\n` : ''}`,
		keywordsContext:
			ctx.keywords.length > 0
				? `\nREQUIRED KEYWORDS/CONSTRAINTS: ${ctx.keywords.join('; ')}\n*** Your ${questionLabel} MUST focus ONLY on these specific keywords and topics. ***\n`
				: ''
	};
}

function buildDiversitySection(
	recentTopics: string[] | undefined,
	opts: { label: string; avoidLabel: string; pickLabel: string }
): string {
	if (!recentTopics?.length) return '';
	return (
		`\nDIVERSITY REQUIREMENT — RECENTLY COVERED ${opts.label} (DO NOT REPEAT THESE):\n` +
		recentTopics.map((t) => `  - ${t}`).join('\n') +
		`\nYou MUST choose a DIFFERENT ${opts.avoidLabel} from those listed above. ${opts.pickLabel}\n`
	);
}

// ── Zod schemas ────────────────────────────────────────────────

const APQuestionFields = {
	question: z
		.string()
		.describe(
			'The AP-level practice question with proper LaTeX formatting for ALL math/science notation'
		),
	optionA: z.string().describe('First answer choice'),
	optionB: z.string().describe('Second answer choice'),
	optionC: z.string().describe('Third answer choice'),
	optionD: z.string().describe('Fourth answer choice'),
	correctAnswer: z.enum(['A', 'B', 'C', 'D']).describe('The letter of the correct answer'),
	explanation: z
		.string()
		.describe('Detailed explanation of the correct answer and why distractors are wrong'),
	// Must be required (not .optional): OpenAI structured outputs require every
	// property key to appear in JSON Schema `required`.
	hint1: z
		.string()
		.describe(
			'Brief progressive hint after a first incorrect answer; do not reveal the correct letter'
		),
	hint2: z
		.string()
		.describe(
			'Stronger progressive hint after a second incorrect answer; still do not reveal the correct letter'
		),
	mainTopic: z
		.string()
		.trim()
		.min(1)
		.max(240)
		.describe(
			'The single primary topic this question tests. When a unit provides MAIN TOPIC OPTIONS, choose exactly one of those options.'
		),
	topicsCovered: z
		.string()
		.describe(
			'1-2 sentence description of the specific concept, subtopic, or scenario this question tests (used for diversity tracking — be precise and distinct)'
		)
} as const;

// OpenAI strict structured outputs do not allow arbitrary object keys
// (`z.record` becomes JSON Schema `propertyNames`). The model writes the
// semantic DiagramSpec as a JSON string; parseGeneratedApQuestion validates and
// converts it back to an object before persistence or rendering.
const APQuestion = z.object({
	...APQuestionFields,
	diagram: z
		.string()
		.nullable()
		.describe(
			'Optional semantic examfig DiagramSpec encoded as a JSON string. Use null when a diagram does not add instructional value.'
		)
});

const APQuestionDataSchema = z.object({
	...APQuestionFields,
	diagram: z
		.record(z.string(), z.unknown())
		.nullable()
		.describe('Parsed semantic examfig DiagramSpec, or null.')
});

assertOpenAiCompatibleObjectSchema(APQuestion, { schemaName: 'ap_question' });

type APQuestionData = z.infer<typeof APQuestionDataSchema>;

/** Exported for OpenAI schema compatibility tests. */
export const apQuestionSchema = APQuestion;

/** Parse the model/batch representation and decode its JSON DiagramSpec. */
export function parseGeneratedApQuestion(input: unknown): APQuestionData {
	const parsed = APQuestion.parse(input);
	let diagram: Record<string, unknown> | null = null;
	if (parsed.diagram !== null) {
		try {
			diagram = z.record(z.string(), z.unknown()).parse(JSON.parse(parsed.diagram));
		} catch (error) {
			throw new Error('Generated diagram was not a valid JSON object string.', { cause: error });
		}
	}
	return APQuestionDataSchema.parse({ ...parsed, diagram });
}

/** JSON Schema for OpenAI Batch `/v1/responses` structured output. */
export function apQuestionJsonSchema(): Record<string, unknown> {
	const schema = z.toJSONSchema(APQuestion) as Record<string, unknown>;
	delete schema.$schema;
	return {
		...schema,
		type: 'object',
		additionalProperties: false
	};
}

export type { APQuestionData };

export interface GenerateTiming {
	generationMs: number;
	persistenceMs: number;
}

export interface GenerateResult {
	answer: APQuestionData;
	provider: string;
	model: string;
	questionId?: string;
	timing?: GenerateTiming;
}

// ── MCQ generation ─────────────────────────────────────────────

/** Build system/user prompts for one MCQ (shared by sync + Batch API paths). */
export function buildMcqGenerationPrompt(opts: {
	className: string;
	unit?: string;
	recentTopics?: string[];
	diagramsEnabled?: boolean;
}): { system: string; user: string } {
	const { className, unit, recentTopics, diagramsEnabled = false } = opts;
	if (!className) throw new Error('className is required');

	const { unitContext, keywordsContext } = buildUnitSections(className, unit, 'question');
	const diversitySection = buildDiversitySection(recentTopics, {
		label: 'TOPICS',
		avoidLabel: 'subtopic, concept, or scenario',
		pickLabel:
			'Pick a fresh angle, an under-tested concept, or a distinct real-world context that has NOT appeared in recent questions.'
	});

	const isBiology = className.toLowerCase().includes('biology');
	const difficultyGuidance = isBiology
		? `\nDIFFICULTY CALIBRATION FOR AP BIOLOGY:\n- Focus on conceptual understanding and application, not memorization of obscure details\n- Use a balanced medium difficulty appropriate for an introductory college-level biology course\n- Emphasize scientific practices over pure recall`
		: '';

	const scopeBlock = `CRITICAL UNIT SCOPE REQUIREMENT:
- Your question MUST stay strictly within the app-authored keywords and focus controls listed above
	- DO NOT incorporate concepts from other units, even if they seem related`;
	const diagramSection = diagramsEnabled
		? EXAMFIG_DIAGRAM_SKILL
		: `
EXAMFIG DIAGRAMS DISABLED:
- Set the required 'diagram' field to null.
- Do not call diagram tools or create diagram JSON.`;

	const systemPrompt = `You are an independent AP-aligned practice question writer. Create high-quality, original practice questions that follow broad course skills and formats without reproducing or closely imitating any official question, passage, stimulus, rubric, or scoring guidance.${unitContext}${keywordsContext}${diversitySection}${difficultyGuidance}

${scopeBlock}
${diagramSection}

QUESTION QUALITY:
- Aim for a medium difficulty level with clear, independent wording.
- Test understanding, not just memorization
- Include real-world scenarios or experimental contexts
- Plausible distractors reflecting common misconceptions
- Options should be roughly equal in length
- Avoid "all of the above" or "none of the above"
- Vary the cognitive level: alternate between recall, application, analysis, and evaluation questions

FORMATTING:
- For ALL math and science notation use LaTeX with these exact delimiters ONLY: $...$ for inline math, $$...$$ for display (block) math. Do NOT use \\(...\\), \\[...\\], \\begin{equation}, \\begin{align}, or any other LaTeX environment delimiters — they will not render.
- For code blocks use the triple backtick syntax (\`\`\`) to enclose code.

EXPLANATION:
- Explain why the correct answer is right
- Address why distractors are incorrect
- Use a newline before each option letter (A, B, C, D) when discussing them
- Be concise with your explanations and don't repeat information unnecessarily

OUTPUT:
- Return ONLY the JSON object matching the schema; no text before or after the JSON`;

	const userMessage = `Create an AP-level practice question for ${className}${unit ? ` covering ${unit}` : ''}.\n\nReturn ONLY the JSON object, no other text.`;

	return { system: systemPrompt, user: userMessage };
}

async function generateAPQuestionBody(opts: {
	className: string;
	unit?: string;
	recentTopics?: string[];
}): Promise<{ parsed: APQuestionData; model: string }> {
	const diagramsEnabled = await isExamfigDiagramsEnabled();
	const { system, user } = buildMcqGenerationPrompt({ ...opts, diagramsEnabled });

	const result = await structuredObject({
		callName: 'generateAPQuestion',
		model: MCQ_GENERATION_MODEL,
		system,
		user,
		schema: APQuestion,
		schemaName: 'ap_question',
		reasoningEffort: 'medium',
		tools: diagramsEnabled ? examfigTools : undefined,
		logContext: { className: opts.className, unit: opts.unit }
	});
	const parsed = parseGeneratedApQuestion(result.parsed);

	if (!diagramsEnabled) {
		return { ...result, parsed: { ...parsed, diagram: null } };
	}

	if (parsed.diagram) {
		const validation = validateExamfigDiagram(parsed.diagram);
		if (!validation.valid) {
			throw new Error(
				`Generated examfig diagram failed validation: ${validation.errors.join('; ')}`
			);
		}
	}
	return { ...result, parsed };
}

export async function generateAPQuestion(opts: {
	className: string;
	unit?: string;
	recentTopics?: string[];
}): Promise<GenerateResult> {
	const { className, unit } = opts;
	const generationStarted = Date.now();
	const { parsed, model } = await generateAPQuestionBody({
		className,
		unit,
		recentTopics: opts.recentTopics
	});
	const generationMs = Date.now() - generationStarted;

	const questionId = randomUUID();
	return {
		answer: parsed,
		provider: 'ai',
		model,
		questionId,
		timing: {
			generationMs,
			persistenceMs: 0
		}
	};
}
