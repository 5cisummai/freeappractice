import { z } from 'zod';
import { saveQuestionToS3 } from '$lib/questions/storage.server';
import { recordMcqGenerated } from '$lib/questions/gen-stats.server';
import unitDescriptions from '$lib/data/unit-descriptionsrevised.json';
import { logger } from '$lib/server/logger';
import { GENERATION_MODEL, structuredObject } from '$lib/ai/service.server';
import { assertOpenAiCompatibleObjectSchema } from '$lib/ai/openai-structured-schema';
import { QuestionGenerationError } from '$lib/questions/question-errors.server';
import { normalizeUnit } from '$lib/questions/util.server';

/**
 * MCQ generation: prompts, structured AI calls, and S3 persistence.
 */

// ── Data-lookup types ──────────────────────────────────────────

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

// ── Unit-context lookup ────────────────────────────────────────

/**
 * Fuzzy-matches `className` to course_code/course_name, then resolves the unit.
 */
function getUnitContextData(className: string, unitIdentifier: string): UnitContext | null {
	if (!className || !unitIdentifier) return null;
	const norm = (s: string) => (s ?? '').toLowerCase().trim();
	const cName = norm(className);
	const uRaw = unitIdentifier.toString().trim();
	const uNorm = norm(uRaw);

	const data = unitDescriptions as {
		courses: Array<{
			course_code?: string;
			course_name?: string;
			important_notes?: string;
			importantNotes?: string;
			units?: Array<{
				unit_number?: number;
				unit_title?: string;
				description?: string;
				topics_may_include?: string[];
				topics?: string[];
				keywords?: string[];
			}>;
		}>;
	};

	if (Array.isArray(data.courses)) {
		for (const course of data.courses) {
			const courseNames = [course.course_code, course.course_name]
				.filter(Boolean)
				.map((n) => norm(n as string));
			const importantNotes = course.important_notes ?? course.importantNotes ?? '';

			if (courseNames.some((n) => n === cName || cName.includes(n) || n.includes(cName))) {
				if (Array.isArray(course.units)) {
					const unitNumMatch = uRaw.match(/\d+/);
					let found = course.units.find((u) => {
						if (unitNumMatch) {
							const num = parseInt(unitNumMatch[0], 10);
							return (
								Number(u.unit_number) === num || norm(u.unit_title ?? '').includes(`unit ${num}`)
							);
						}
						return false;
					});
					if (!found) {
						found = course.units.find(
							(u) =>
								norm(u.unit_title ?? '').includes(uNorm) || uNorm.includes(norm(u.unit_title ?? ''))
						);
					}
					if (found) {
						return {
							description: found.description ?? '',
							topics: found.topics_may_include ?? found.topics ?? [],
							keywords: found.keywords ?? [],
							importantNotes
						};
					}
				}
				if (importantNotes) return { description: '', topics: [], keywords: [], importantNotes };
			}
		}
	}
	return null;
}

// ── Prompt builders ────────────────────────────────────────────

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

// ── Persistence ────────────────────────────────────────────────

async function persistMcqQuestionToS3(
	parsed: APQuestionData,
	className: string,
	unit: string | undefined
): Promise<string> {
	const unitLabel = normalizeUnit(unit, 'General');
	const id = await saveQuestionToS3({
		...parsed,
		apClass: className,
		unit: unitLabel
	});
	try {
		await recordMcqGenerated({
			apClass: className,
			unit: unitLabel,
			questionText: parsed.question
		});
	} catch (e) {
		logger.error('recordMcqGenerated failed after S3 save', {
			error: e instanceof Error ? e.message : String(e),
			className,
			unit: unitLabel
		});
	}
	return id;
}

function isAPLunch(className: string): boolean {
	return (className ?? '').toLowerCase().includes('ap lunch');
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

	const lunchMode = isAPLunch(className);

	const scopeBlock = lunchMode
		? `TOPIC SCOPE:
- Keep the humor centered on high school lunch culture: cafeteria lines, mystery meat, snack trades, saving tables, vending machines, brown-bag shame, lunch ladies, milk cartons, and related chaos.
- The joke should land even if the student has never taken a real AP exam.`
		: `CRITICAL UNIT SCOPE REQUIREMENT:
- Your question MUST stay strictly within the unit's specified keywords and topics listed above
- DO NOT incorporate concepts from other units, even if they seem related`;

	const systemPrompt = lunchMode
		? `You are the world's foremost scholar of AP Lunch — a totally real Advanced Placement course about cafeteria survival. Write hilarious multiple-choice questions that sound like over-serious AP prompts but are actually about lunch.${unitContext}${diversitySection}

${scopeBlock}

QUESTION QUALITY:
- Be genuinely funny; dry academic tone + absurd lunch scenarios works best
- All four options should be plausible in the joke's universe; the "correct" answer should be the funniest or most logically absurd
- Reference the selected unit when one is provided
- Keep it school-appropriate: no cruelty, slurs, or mean-spirited jokes about real students
- Options should be roughly equal in length

FORMATTING:
- For ALL math and science notation use LaTeX with these exact delimiters ONLY: $...$ for inline math, $$...$$ for display (block) math. Do NOT use \\(...\\), \\[...\\], \\begin{equation}, \\begin{align}, or any other LaTeX environment delimiters — they will not render. (only if a fake formula genuinely improves the joke)

EXPLANATION:
- Stay in character as an AP Lunch grader explaining the "correct" answer with deadpan seriousness
- Use a newline before each option letter (A, B, C, D) when discussing them

OUTPUT:
- Return ONLY the JSON object matching the schema; no text before or after the JSON`
		: `You are an expert AP exam question writer with deep knowledge of College Board standards. Create high-quality, authentic practice questions that closely mirror real AP exam questions.${unitContext}${keywordsContext}${courseNotesContext}${diversitySection}${difficultyGuidance}

${scopeBlock}

QUESTION QUALITY:
- Match actual AP exam difficulty and style
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

	const userMessage = lunchMode
		? `Create a hilarious AP Lunch multiple-choice question${unit ? ` for ${unit}` : ''}.\n\nReturn ONLY the JSON object, no other text.`
		: `Create an AP-level practice question for ${className}${unit ? ` covering ${unit}` : ''}.\n\nReturn ONLY the JSON object, no other text.`;

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
		model: GENERATION_MODEL,
		system,
		user,
		schema: APQuestion,
		schemaName: 'ap_question',
		reasoningEffort: 'medium',
		logContext: { className: opts.className, unit: opts.unit }
	});
}

/** Persist an already-parsed MCQ to S3 (canonical archive). */
export async function persistParsedMcqToS3(
	parsed: APQuestionData,
	className: string,
	unit: string | undefined
): Promise<string> {
	return persistMcqQuestionToS3(parsed, className, unit);
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

	let questionId: string;
	const persistenceStarted = Date.now();
	try {
		questionId = await persistMcqQuestionToS3(parsed, className, unit);
	} catch (err) {
		logger.error('Failed to persist generated question to S3', {
			className,
			unit,
			error: err
		});
		throw new QuestionGenerationError('Failed to persist generated question', { cause: err });
	}
	return {
		answer: parsed,
		provider: 'ai',
		model,
		questionId,
		timing: {
			generationMs,
			persistenceMs: Date.now() - persistenceStarted
		}
	};
}
