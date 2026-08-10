import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import unitDescriptions from '$lib/data/unit-descriptionsrevised.json';
import { MCQ_GENERATION_MODEL } from '$lib/ai/ai-models-config';
import { EXAMFIG_DIAGRAM_SKILL } from '$lib/ai/examfig-skill';
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
	importantNotes: string;
}

interface UnitPromptSections {
	unitContext: string;
	keywordsContext: string;
	courseNotesContext: string;
}

type UnitDescriptionsFile = {
	courses: Array<{
		apClass: string;
		importantNotes?: string;
		units: Array<{
			unit: string;
			description?: string;
			topics?: string[];
			keywords?: string[];
		}>;
	}>;
};

function unitContextKey(apClass: string, unit: string): string {
	return `${apClass}\0${unit}`;
}

/** Exact apClass + unit label → CED context. Built once from catalog-aligned JSON. */
const unitContextByKey: ReadonlyMap<string, UnitContext> = (() => {
	const data = unitDescriptions as UnitDescriptionsFile;
	const map = new Map<string, UnitContext>();
	for (const course of data.courses ?? []) {
		const importantNotes = course.importantNotes ?? '';
		for (const unit of course.units ?? []) {
			map.set(unitContextKey(course.apClass, unit.unit), {
				description: unit.description ?? '',
				topics: unit.topics ?? [],
				keywords: unit.keywords ?? [],
				importantNotes
			});
		}
	}
	return map;
})();

/** Exact lookup only — keys must match `ap-classes.json` class names and unit labels. */
export function getUnitContextData(className: string, unitIdentifier: string): UnitContext | null {
	if (!className || !unitIdentifier) return null;
	return unitContextByKey.get(unitContextKey(className, unitIdentifier.trim())) ?? null;
}

function buildUnitSections(
	className: string,
	unit: string | undefined,
	questionLabel = 'question'
): UnitPromptSections {
	if (!className || !unit) return { unitContext: '', keywordsContext: '', courseNotesContext: '' };
	const ctx = getUnitContextData(className, unit);
	if (!ctx) return { unitContext: '', keywordsContext: '', courseNotesContext: '' };
	return {
		unitContext: `\nUNIT CONTEXT: ${unit}\n${ctx.description}\nKey Topics: ${ctx.topics.join(', ')}\n`,
		keywordsContext:
			ctx.keywords.length > 0
				? `\nREQUIRED KEYWORDS/CONSTRAINTS: ${ctx.keywords.join('; ')}\n*** Your ${questionLabel} MUST focus ONLY on these specific keywords and topics. ***\n`
				: '',
		courseNotesContext: ctx.importantNotes ? `\nCOURSE-GUIDANCE: ${ctx.importantNotes}\n` : ''
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

const APQuestion = z.object({
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
	topicsCovered: z
		.string()
		.describe(
			'1-2 sentence description of the specific concept, subtopic, or scenario this question tests (used for diversity tracking — be precise and distinct)'
		),
	// Required-but-nullable keeps the field compatible with OpenAI structured outputs.
	diagram: z
		.record(z.string(), z.unknown())
		.nullable()
		.describe(
			'Optional semantic examfig DiagramSpec. Use null when a diagram does not add instructional value.'
		)
});

assertOpenAiCompatibleObjectSchema(APQuestion, { schemaName: 'ap_question' });

type APQuestionData = z.infer<typeof APQuestion>;

/** Exported for OpenAI schema compatibility tests. */
export const apQuestionSchema = APQuestion;

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
}): { system: string; user: string } {
	const { className, unit, recentTopics } = opts;
	if (!className) throw new Error('className is required');

	const { unitContext, keywordsContext, courseNotesContext } = buildUnitSections(
		className,
		unit,
		'question'
	);
	const diversitySection = buildDiversitySection(recentTopics, {
		label: 'TOPICS',
		avoidLabel: 'subtopic, concept, or scenario',
		pickLabel:
			'Pick a fresh angle, an under-tested concept, or a distinct real-world context that has NOT appeared in recent questions.'
	});

	const isBiology = className.toLowerCase().includes('biology');
	const difficultyGuidance = isBiology
		? `\nDIFFICULTY CALIBRATION FOR AP BIOLOGY:\n- Focus on conceptual understanding and application, not memorization of obscure details\n- Match the difficulty of questions in the official AP Biology Course and Exam Description\n- Emphasize scientific practices over pure recall`
		: '';

	const scopeBlock = `CRITICAL UNIT SCOPE REQUIREMENT:
- Your question MUST stay strictly within the unit's specified keywords and topics listed above
	- DO NOT incorporate concepts from other units, even if they seem related`;

	const systemPrompt = `You are an expert AP exam question writer with deep knowledge of College Board standards. Create high-quality, authentic practice questions that closely mirror real AP exam questions.${unitContext}${keywordsContext}${courseNotesContext}${diversitySection}${difficultyGuidance}

${scopeBlock}
${EXAMFIG_DIAGRAM_SKILL}

QUESTION QUALITY:
- Match actual AP exam difficulty and style, aim for the medium difficulty level, rather the very hard ones.
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
	const { system, user } = buildMcqGenerationPrompt(opts);

	return structuredObject({
		callName: 'generateAPQuestion',
		model: MCQ_GENERATION_MODEL,
		system,
		user,
		schema: APQuestion,
		schemaName: 'ap_question',
		reasoningEffort: 'medium',
		tools: examfigTools,
		logContext: { className: opts.className, unit: opts.unit }
	}).then((result) => {
		if (result.parsed.diagram) {
			const validation = validateExamfigDiagram(result.parsed.diagram);
			if (!validation.valid) {
				throw new Error(
					`Generated examfig diagram failed validation: ${validation.errors.join('; ')}`
				);
			}
		}
		return result;
	});
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
