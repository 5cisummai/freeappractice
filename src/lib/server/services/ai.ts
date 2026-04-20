import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { OPEN_AI_KEY } from '$env/static/private';
import { env } from '$env/dynamic/private';
import { saveQuestionToS3 } from './question-storage';
import { recordMcqGenerated } from './question-gen-stats';
import unitDescriptions from '$lib/data/unit-descriptionsrevised.json';
import frqSpecs from '$lib/data/ap-frq-specs.json';
import { logger } from '$lib/server/logger';

/**
 * Server-side AP question generation and FRQ grading via OpenAI’s structured-output API (`chat.completions.parse`).
 *
 * Flow: static JSON (`unit-descriptionsrevised`, `ap-frq-specs`) → prompt sections → Zod `response_format` → typed result.
 * MCQ results are optionally persisted asynchronously so API latency does not wait on S3/Mongo.
 */

// `OPENAI_URL` supports local gateways (e.g. LM Studio); `OPENAI_BASE_URL` is the conventional name.
const OPENAI_BASE_URL = env.OPENAI_BASE_URL ?? env.OPENAI_URL ?? 'https://api.openai.com/v1';
const ADVANCED_MODEL = env.ADVANCED_MODEL ?? 'gpt-5-mini';
const BASIC_MODEL = env.BASIC_MODEL ?? 'gpt-5.4-nano';

interface UnitContext {
	description: string;
	topics: string[];
	keywords: string[];
	importantNotes: string;
}

interface FRQSpecContext {
	frqOverview: string;
	questionTypes: string;
	rubricConventions: string;
	importantNotes: string;
	globalTaskVerbs: string;
	universalErrors: string;
}

interface UnitPromptSections {
	unitContext: string;
	keywordsContext: string;
	courseNotesContext: string;
}

/**
 * Looks up `unitDescriptions` by fuzzy-matching `className` to course_code/course_name, then resolves the unit:
 * prefer a digit in `unitIdentifier` against `unit_number` / title, else substring match on the unit title.
 * Returns course-level notes alone when the course matches but no unit row fits (still useful for prompts).
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

/**
 * Builds FRQ prompt text from `frqSpecs`: course-specific structure/rubric plus **global** AP task verbs and universal errors.
 * Object fields are stringified for the model as plain text (consistent with how we feed JSON blobs into prompts elsewhere).
 */
function getFRQSpecData(className: string): FRQSpecContext | null {
	if (!className) return null;
	const norm = (s: string) => (s ?? '').toLowerCase().trim();
	const cName = norm(className);

	const data = frqSpecs as {
		global_frq_principles: {
			task_verbs?: Record<string, string>;
			universal_errors_to_avoid?: string[];
		};
		courses: Array<{
			course_code?: string;
			course_name?: string;
			frq_overview?: Record<string, unknown>;
			question_types?: Array<{
				type: string;
				typical_position?: string;
				description?: string;
				common_parts?: string[];
				scoring_notes?: string[];
				notes?: string;
			}>;
			rubric_conventions?: unknown;
			important_notes?: unknown;
		}>;
	};

	const globalPrinciples = data.global_frq_principles;
	const globalTaskVerbs = globalPrinciples.task_verbs
		? Object.entries(globalPrinciples.task_verbs)
				.map(([verb, def]) => `  ${verb}: ${def}`)
				.join('\n')
		: '';
	const universalErrors = Array.isArray(globalPrinciples.universal_errors_to_avoid)
		? globalPrinciples.universal_errors_to_avoid.map((e) => `  - ${e}`).join('\n')
		: '';

	for (const course of data.courses) {
		const courseNames = [course.course_code, course.course_name]
			.filter(Boolean)
			.map((n) => norm(n as string));

		if (courseNames.some((n) => n === cName || cName.includes(n) || n.includes(cName))) {
			const frqOverview = course.frq_overview ? JSON.stringify(course.frq_overview, null, 2) : '';

			const questionTypes = Array.isArray(course.question_types)
				? course.question_types
						.map((qt) => {
							const parts = [
								`TYPE: ${qt.type}${qt.typical_position ? ` (${qt.typical_position})` : ''}`,
								qt.description ? `  Description: ${qt.description}` : '',
								qt.notes ? `  Notes: ${qt.notes}` : '',
								qt.common_parts?.length
									? `  Common parts:\n${qt.common_parts.map((p) => `    - ${p}`).join('\n')}`
									: '',
								qt.scoring_notes?.length
									? `  Scoring notes:\n${qt.scoring_notes.map((n) => `    * ${n}`).join('\n')}`
									: ''
							]
								.filter(Boolean)
								.join('\n');
							return parts;
						})
						.join('\n\n')
				: '';

			const rubricConventions =
				typeof course.rubric_conventions === 'object' && course.rubric_conventions !== null
					? JSON.stringify(course.rubric_conventions, null, 2)
					: typeof course.rubric_conventions === 'string'
						? course.rubric_conventions
						: '';

			const importantNotes = Array.isArray(course.important_notes)
				? (course.important_notes as string[]).map((n) => `  - ${n}`).join('\n')
				: typeof course.important_notes === 'string'
					? course.important_notes
					: '';

			return {
				frqOverview,
				questionTypes,
				rubricConventions,
				importantNotes,
				globalTaskVerbs,
				universalErrors
			};
		}
	}
	return null;
}

/**
 * Humanities/social courses use `BASIC_MODEL`; STEM-style workloads use `ADVANCED_MODEL`.
 * Intent: cheaper/faster generations where prompts are less math-notation heavy (tunable via env).
 */
function selectModelForClass(className: string): string {
	const normalized = (className ?? '').toLowerCase();
	const wideModel = [
		'history',
		'government',
		'economics',
		'psychology',
		'sociology',
		'human geography',
		'world studies',
		'english',
		'literature',
		'computer science principles'
	];
	if (wideModel.some((kw) => normalized.includes(kw))) return BASIC_MODEL;
	return ADVANCED_MODEL;
}

function buildClient(): OpenAI {
	if (!OPEN_AI_KEY) throw new Error('OPEN_AI_KEY is not set');
	return new OpenAI({ baseURL: OPENAI_BASE_URL, apiKey: OPEN_AI_KEY });
}

/** Injects unit description, optional keyword constraints, and course notes from `getUnitContextData`. */
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

/**
 * `recentTopics` should be short summaries (aligned with `topicsCovered` on prior questions) so the model avoids repeating themes.
 */
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

/** Concatenates non-empty FRQ spec blocks so we never send headers with blank bodies. */
function buildFRQSpecSections(frqSpec: FRQSpecContext | null): string {
	if (!frqSpec) return '';
	const sections: Array<[string, string]> = [
		['\nFRQ EXAM OVERVIEW (use for point distribution and structure):\n', frqSpec.frqOverview],
		[
			'\nKNOWN FRQ QUESTION TYPES FOR THIS COURSE (choose the most relevant for the unit):\n',
			frqSpec.questionTypes
		],
		['\nRUBRIC CONVENTIONS (follow strictly):\n', frqSpec.rubricConventions],
		['\nCOURSE-SPECIFIC IMPORTANT NOTES:\n', frqSpec.importantNotes],
		[
			'\nAP TASK VERB DEFINITIONS (use the correct verb and match the expected depth of response):\n',
			frqSpec.globalTaskVerbs
		],
		[
			'\nUNIVERSAL AP FRQ ERRORS TO AVOID in your generated question, scoring criteria, and model answers:\n',
			frqSpec.universalErrors
		]
	];
	return sections
		.filter(([, value]) => value)
		.map(([header, value]) => header + value + '\n')
		.join('');
}

/**
 * Single choke point for `completions.parse`: builds the client, logs usage, maps provider failures and refusals.
 * Callers pass the Zod-backed `response_format` on `params`; `T` is the parsed message payload.
 */
async function runStructuredCompletion<T>(
	callName: string,
	params: Parameters<OpenAI['chat']['completions']['parse']>[0],
	logContext: Record<string, unknown>
): Promise<{ parsed: T; model: string }> {
	const client = buildClient();
	const doneAiCall = logger.aiCall(callName, params.model, logContext);
	let completion;
	try {
		completion = await client.chat.completions.parse(params);
	} catch (err) {
		logger.error(`[ai] ${callName} failed`, { ...logContext, model: params.model, error: err });
		throw err;
	}
	const msg = completion?.choices?.[0]?.message;
	if (!msg) throw new Error('No message returned from provider');
	if (msg.refusal) throw new Error('Content refused by provider');
	const parsed = msg.parsed as T;
	if (!parsed) throw new Error('No parsed output from structured response');
	doneAiCall({
		promptTokens: completion.usage?.prompt_tokens,
		completionTokens: completion.usage?.completion_tokens
	});
	return { parsed, model: params.model };
}

/** Structured MCQ; `topicsCovered` feeds future `recentTopics` / diversity, not the stored S3 payload alone. */
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
	topicsCovered: z
		.string()
		.describe(
			'1-2 sentence description of the specific concept, subtopic, or scenario this question tests (used for diversity tracking — be precise and distinct)'
		)
});

export type APQuestionData = z.infer<typeof APQuestion>;

export interface GenerateResult {
	answer: APQuestionData;
	provider: string;
	model: string;
	questionId?: string;
	cached?: boolean;
}

/**
 * Persists a generated MCQ to S3 and increments Mongo generation stats (per class, per unit, global unit rollup).
 * Call this for every newly generated AP MCQ so counts stay accurate without scanning S3.
 */
export async function persistGeneratedMcqQuestion(
	parsed: APQuestionData,
	className: string,
	unit: string | undefined
): Promise<string> {
	const unitLabel = unit ?? 'General';
	const questionData = Object.assign({}, parsed, { apClass: className, unit: unitLabel });
	const id = await saveQuestionToS3(questionData);
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

// Client UI renders math from `$...$` / `$$...$$` only; other LaTeX delimiters would display raw or break.
const LATEX_RULE =
	'For ALL math and science notation use LaTeX with these exact delimiters ONLY: $...$ for inline math, $$...$$ for display (block) math. Do NOT use \\(...\\), \\[...\\], \\begin{equation}, \\begin{align}, or any other LaTeX environment delimiters — they will not render.';

/**
 * MCQ generation: `customTopic` bypasses unit JSON and diversity lists (ad-hoc practice).
 * `reasoning_effort` is applied only when using `ADVANCED_MODEL` — some mini models ignore or reject the field.
 */
export async function generateAPQuestion(opts: {
	className: string;
	unit?: string;
	recentTopics?: string[];
	/** When set, generates for this user-specified topic (not pooled/cached server-side). */
	customTopic?: string;
}): Promise<GenerateResult> {
	const { className, unit, recentTopics, customTopic } = opts;
	if (!className) throw new Error('className is required');

	const ct = customTopic?.trim() ?? '';
	const isCustom = ct.length > 0;

	let unitContext: string;
	let keywordsContext = '';
	let courseNotesContext = '';
	let diversitySection = '';

	if (isCustom) {
		unitContext = `
USER-SPECIFIED TOPIC (PRIMARY — THE ENTIRE QUESTION MUST CENTER ON THIS):
${ct}
`;
	} else {
		const sections = buildUnitSections(className, unit, 'question');
		unitContext = sections.unitContext;
		keywordsContext = sections.keywordsContext;
		courseNotesContext = sections.courseNotesContext;
		diversitySection = buildDiversitySection(recentTopics, {
			label: 'TOPICS',
			avoidLabel: 'subtopic, concept, or scenario',
			pickLabel:
				'Pick a fresh angle, an under-tested concept, or a distinct real-world context that has NOT appeared in recent questions.'
		});
	}

	// Extra calibration block: Bio has distinct CED-style expectations worth spelling out in-system.
	const isBiology = className.toLowerCase().includes('biology');
	const difficultyGuidance = isBiology
		? `\nDIFFICULTY CALIBRATION FOR AP BIOLOGY:\n- Focus on conceptual understanding and application, not memorization of obscure details\n- Match the difficulty of questions in the official AP Biology Course and Exam Description\n- Emphasize scientific practices over pure recall`
		: '';

	const scopeBlock = isCustom
		? `TOPIC SCOPE:
- The question MUST assess understanding directly related to the user-specified topic above within ${className}.
- Stay aligned with College Board standards for that course; do not drift into unrelated subjects.`
		: `CRITICAL UNIT SCOPE REQUIREMENT:
- Your question MUST stay strictly within the unit's specified keywords and topics listed above
- DO NOT incorporate concepts from other units, even if they seem related`;

	const systemPrompt = `You are an expert AP exam question writer with deep knowledge of College Board standards. Create high-quality, authentic practice questions that closely mirror real AP exam questions.${unitContext}${keywordsContext}${courseNotesContext}${diversitySection}${difficultyGuidance}

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
- ${LATEX_RULE}
- For code blocks use the triple backtick syntax (\`\`\`) to enclose code.

EXPLANATION:
- Explain why the correct answer is right
- Address why distractors are incorrect
- Use a newline before each option letter (A, B, C, D) when discussing them
- Be concise with your explanations and don't repeat information unnecessarily

OUTPUT:
- Return ONLY the JSON object matching the schema; no text before or after the JSON`;

	const model = selectModelForClass(className);
	const userMessage = isCustom
		? `Create an AP-level practice multiple-choice question for ${className} focused on this topic: ${ct}\n\nReturn ONLY the JSON object, no other text.`
		: `Create an AP-level practice question for ${className}${unit ? ` covering ${unit}` : ''}.\n\nReturn ONLY the JSON object, no other text.`;

	const completionParams: Parameters<OpenAI['chat']['completions']['parse']>[0] = {
		model,
		messages: [
			{ role: 'system', content: systemPrompt },
			{
				role: 'user',
				content: userMessage
			}
		],
		response_format: zodResponseFormat(APQuestion, 'ap_question')
	};
	if (model === ADVANCED_MODEL) {
		(completionParams as unknown as Record<string, unknown>).reasoning_effort = 'medium';
	}

	const { parsed } = await runStructuredCompletion<APQuestionData>(
		'generateAPQuestion',
		completionParams,
		{ className, unit, customTopic: isCustom ? ct : undefined }
	);

	const persistUnitLabel = isCustom ? `Custom: ${ct}` : unit;
	// Persist after success: user gets the question immediately; S3/Mongo failures must not fail the request.
	let questionId: string | undefined;
	void persistGeneratedMcqQuestion(parsed, className, persistUnitLabel)
		.then((id) => {
			questionId = id;
		})
		.catch(() => {
			/* non-critical */
		});

	return { answer: parsed, provider: 'openai', model, questionId };
}

/** FRQ sub-parts are capped at 4 to stay within typical AP exam structure and keep grading tractable. */
const FRQPart = z.object({
	label: z.string().describe("Sub-part label: 'a', 'b', 'c', or 'd'"),
	question: z.string().describe('The sub-part question text'),
	pointValue: z.number().int().min(1).describe('Points this sub-part is worth'),
	scoringCriteria: z.string().describe('Specific criteria the grader uses to award points'),
	modelAnswer: z.string().describe('A complete, full-credit model answer for this sub-part')
});

const FRQQuestion = z.object({
	prompt: z
		.string()
		.describe('The main FRQ stem (scenario, data set, or background context for the question)'),
	context: z
		.string()
		.nullable()
		.describe(
			'Optional stimulus or passage that all sub-parts reference, or null if not applicable'
		),
	parts: z.array(FRQPart).min(2).max(4).describe('The sub-parts of the FRQ'),
	totalPoints: z.number().int().min(2).describe('Sum of all part point values'),
	topicsCovered: z
		.string()
		.describe(
			'1-2 sentence description of the specific concept, scenario, or FRQ type this question tests (used for diversity tracking — be precise and distinct)'
		)
});

export type FRQQuestionData = z.infer<typeof FRQQuestion>;

export interface GenerateFRQResult {
	question: FRQQuestionData;
	provider: string;
	model: string;
	questionId?: string;
	cached?: boolean;
}

/**
 * FRQs merge unit context, `getFRQSpecData` (overview + rubric), and optional diversity.
 * Unlike MCQ, we always send `reasoning_effort: 'medium'` here — FRQs need coherent multi-part structure.
 */
export async function generateFRQQuestion(opts: {
	className: string;
	unit?: string;
	recentTopics?: string[];
	customTopic?: string;
}): Promise<GenerateFRQResult> {
	const { className, unit, recentTopics, customTopic } = opts;
	if (!className) throw new Error('className is required');

	const ct = customTopic?.trim() ?? '';
	const isCustom = ct.length > 0;

	let unitContext: string;
	let keywordsContext = '';
	let courseNotesContext = '';
	let diversitySection = '';

	if (isCustom) {
		unitContext = `
USER-SPECIFIED TOPIC (PRIMARY — THE ENTIRE FRQ MUST CENTER ON THIS):
${ct}
`;
	} else {
		const sections = buildUnitSections(className, unit, 'FRQ');
		unitContext = sections.unitContext;
		keywordsContext = sections.keywordsContext;
		courseNotesContext = sections.courseNotesContext;
		diversitySection = buildDiversitySection(recentTopics, {
			label: 'FRQ TOPICS',
			avoidLabel: 'scenario, question type, or concept',
			pickLabel: 'Select a fresh context or a less-common but exam-relevant FRQ type.'
		});
	}

	const frqSpecSections = buildFRQSpecSections(getFRQSpecData(className));

	const scopeLine = isCustom
		? `TOPIC SCOPE: The FRQ must assess skills and content related to the user-specified topic within ${className}. Stay aligned with College Board expectations for that course.`
		: "CRITICAL UNIT SCOPE: Stay strictly within the specified unit's keywords and topics.";

	const systemPrompt = `You are an expert AP exam question writer. Create a College Board–style Free Response Question (FRQ) for ${className}${unit && !isCustom ? `, ${unit}` : ''}.${unitContext}${keywordsContext}${courseNotesContext}${frqSpecSections}${diversitySection}

${scopeLine}

FRQ STRUCTURE:
- Write a main prompt/scenario (may include a stimulus such as a graph, data table, or passage in the "context" field)
- Include 2–4 sub-parts (a, b, c, d) in increasing difficulty
- Each sub-part must have a pointValue, scoringCriteria (what earns points), and a modelAnswer
- totalPoints must equal the sum of all part pointValues; use the exam overview above for realistic point distribution

QUALITY:
- Select a question type from the known types listed above that best fits the unit; mirror its common parts and depth
- Match authentic AP exam FRQ style and difficulty
- The first sub-part should be the easiest; each subsequent part increases in difficulty and builds logically on previous parts
- Scoring criteria must be specific, rubric-aligned, and unambiguous - use the rubric conventions above
- Model answers must be complete and earn full credit
- ${LATEX_RULE}`;

	const model = selectModelForClass(className);
	const frqUserMessage = isCustom
		? `Create an AP-level FRQ for ${className} focused on this topic: ${ct}.`
		: `Create an AP-level FRQ for ${className}${unit ? ` covering ${unit}` : ''}.`;

	const { parsed } = await runStructuredCompletion<FRQQuestionData>(
		'generateFRQQuestion',
		{
			model,
			messages: [
				{ role: 'system', content: systemPrompt },
				{
					role: 'user',
					content: frqUserMessage
				}
			],
			response_format: zodResponseFormat(FRQQuestion, 'frq_question'),
			reasoning_effort: 'medium'
		},
		{ className, unit, customTopic: isCustom ? ct : undefined }
	);

	return { question: parsed, provider: 'openai', model };
}

/** Rubric-aligned grading output; scores are percentages per part plus an overall. */
const FRQPartGrade = z.object({
	label: z.string(),
	pointsEarned: z.number().min(0),
	pointsAvailable: z.number().min(1),
	score: z.number().min(0).max(100).describe('Percentage score for this part (0–100)'),
	feedback: z
		.string()
		.describe('Specific feedback explaining what was correct and what was missing')
});

const FRQGradeResult = z.object({
	parts: z.array(FRQPartGrade),
	totalScore: z.number().min(0).max(100).describe('Overall percentage score (0–100)'),
	overallFeedback: z.string().describe('A 2–3 sentence summary of the student performance')
});

export type FRQGradeData = z.infer<typeof FRQGradeResult>;

export interface GradeFRQResult {
	grade: FRQGradeData;
	provider: string;
	model: string;
}

/**
 * Grading uses a fixed small model (`gpt-4.1-mini`) for cost/latency; it does not use `selectModelForClass`.
 * The prompt embeds criteria + model answers so grading stays grounded in the same rubric shown to students.
 */
export async function gradeFRQResponse(opts: {
	className: string;
	unit?: string;
	parts: Array<{
		label: string;
		question: string;
		pointValue: number;
		scoringCriteria: string;
		modelAnswer: string;
	}>;
	responses: Record<string, string>; // label → student response
}): Promise<GradeFRQResult> {
	const { className, unit, parts, responses } = opts;

	const partsText = parts
		.map((p) => {
			const response = responses[p.label] ?? '(no response)';
			return `Sub-part (${p.label}) [${p.pointValue} pts]
Question: ${p.question}
Scoring Criteria: ${p.scoringCriteria}
Model Answer: ${p.modelAnswer}
Student Response: ${response}`;
		})
		.join('\n\n');

	const model = 'gpt-4.1-mini';
	const { parsed } = await runStructuredCompletion<FRQGradeData>(
		'gradeFRQResponse',
		{
			model,
			messages: [
				{
					role: 'system',
					content: `You are an experienced AP exam grader. Grade the following student FRQ response for ${className}${unit ? `, ${unit}` : ''} strictly and fairly according to the scoring criteria provided. Award partial credit where appropriate.`
				},
				{ role: 'user', content: `Grade the following FRQ attempt:\n\n${partsText}` }
			],
			response_format: zodResponseFormat(FRQGradeResult, 'frq_grade')
		},
		{ className, unit }
	);

	return { grade: parsed, provider: 'openai', model };
}
