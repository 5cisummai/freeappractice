import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { OPEN_AI_KEY } from '$env/static/private';
import { env } from '$env/dynamic/private';
import { saveQuestionToS3 } from './question-storage';
import unitDescriptions from '$lib/data/unit-descriptionsrevised.json';
import frqSpecs from '$lib/data/ap-frq-specs.json';
import { logger } from '$lib/server/logger';

const OPENAI_BASE_URL = env.OPENAI_BASE_URL ?? env.OPENAI_URL ?? 'https://api.openai.com/v1';

// ── Unit context lookup ─────────────────────────────────────
interface UnitContext {
	description: string;
	topics: string[];
	keywords: string[];
	importantNotes: string;
}

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

// ── FRQ spec lookup ────────────────────────────────────────
interface FRQSpecContext {
	frqOverview: string;
	questionTypes: string;
	rubricConventions: string;
	importantNotes: string;
	globalTaskVerbs: string;
	universalErrors: string;
}

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
	if (wideModel.some((kw) => normalized.includes(kw))) return 'gpt-4.1-mini';
	return 'gpt-5-mini';
}

function buildClient(): OpenAI {
	if (!OPEN_AI_KEY) throw new Error('OPEN_AI_KEY is not set');
	return new OpenAI({ baseURL: OPENAI_BASE_URL, apiKey: OPEN_AI_KEY });
}

// ── Zod schema for structured response ─────────────────────
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
		.describe('Detailed explanation of the correct answer and why distractors are wrong')
});

export type APQuestionData = z.infer<typeof APQuestion>;

export interface GenerateResult {
	answer: APQuestionData;
	provider: string;
	model: string;
	questionId?: string;
	cached?: boolean;
}

export async function generateAPQuestion(opts: {
	className: string;
	unit?: string;
}): Promise<GenerateResult> {
	const { className, unit } = opts;
	if (!className) throw new Error('className is required');

	let question = `Create an AP-level practice question for ${className}`;
	if (unit) question += ` covering ${unit}`;
	question += '.\n\nReturn ONLY the JSON object, no other text.';

	let unitContext = '';
	let keywordsContext = '';
	let courseNotesContext = '';

	if (className && unit) {
		const ctx = getUnitContextData(className, unit);
		if (ctx) {
			unitContext = `\nUNIT CONTEXT: ${unit}\n${ctx.description}\nKey Topics: ${ctx.topics.join(', ')}\n`;
			if (ctx.keywords.length > 0) {
				keywordsContext = `\nREQUIRED KEYWORDS/CONSTRAINTS: ${ctx.keywords.join('; ')}\n*** Your question MUST focus ONLY on these specific keywords and topics. ***\n`;
			}
			if (ctx.importantNotes) {
				courseNotesContext = `\nCOURSE-GUIDANCE: ${ctx.importantNotes}\n`;
			}
		}
	}

	const isBiology = className?.toLowerCase().includes('biology');
	const difficultyGuidance = isBiology
		? `\nDIFFICULTY CALIBRATION FOR AP BIOLOGY:
- Focus on conceptual understanding and application, not memorization of obscure details
- Match the difficulty of questions in the official AP Biology Course and Exam Description
- Emphasize scientific practices over pure recall`
		: '';

	const systemPrompt = `You are an expert AP exam question writer with deep knowledge of College Board standards. Create high-quality, authentic practice questions that closely mirror real AP exam questions.${unitContext}${keywordsContext}${courseNotesContext}${difficultyGuidance}

CRITICAL UNIT SCOPE REQUIREMENT:
- Your question MUST stay strictly within the unit's specified keywords and topics listed above
- DO NOT incorporate concepts from other units, even if they seem related

QUESTION QUALITY:
- Match actual AP exam difficulty and style
- Test understanding, not just memorization
- Include real-world scenarios or experimental contexts
- Plausible distractors reflecting common misconceptions
- Options should be roughly equal in length
- Avoid "all of the above" or "none of the above"

FORMATTING:
- Use perfect markdown formatting for any math/science notation and for code blocks use the triple backtick syntax (\`\`\`) to enclose code.

EXPLANATION:
- Explain why the correct answer is right
- Address why distractors are incorrect
- Use a newline before each option letter (A, B, C, D) when discussing them
- Be concise with your explanations and don't repeat information unnecessarily

OUTPUT:
- Return ONLY the JSON object matching the schema; no text before or after the JSON`;

	const client = buildClient();
	const model = selectModelForClass(className);

	const completionParams: Parameters<typeof client.chat.completions.parse>[0] = {
		model,
		messages: [
			{ role: 'system', content: systemPrompt },
			{ role: 'user', content: question }
		],
		response_format: zodResponseFormat(APQuestion, 'ap_question')
	};
	if (model === 'gpt-5-mini') {
		(completionParams as unknown as Record<string, unknown>).reasoning_effort = 'low';
	}

	const doneAiCall = logger.aiCall('generateAPQuestion', model, { className, unit });
	let completion;
	try {
		completion = await client.chat.completions.parse(completionParams);
	} catch (err) {
		logger.error('[ai] generateAPQuestion failed', { className, unit, model, error: err });
		throw err;
	}
	const msg = completion?.choices?.[0]?.message;
	if (!msg) throw new Error('No message returned from provider');
	if (msg.refusal) throw new Error('Content refused by provider');
	const parsed = msg.parsed;
	if (!parsed) throw new Error('No parsed output from structured response');
	doneAiCall({
		promptTokens: completion.usage?.prompt_tokens,
		completionTokens: completion.usage?.completion_tokens
	});

	// Fire-and-forget S3 save — don't block the response
	let questionId: string | undefined;
	saveQuestionToS3(Object.assign({}, parsed, { apClass: className, unit: unit ?? 'General' }))
		.then((id) => {
			questionId = id;
		})
		.catch(() => {
			/* non-critical */
		});

	return { answer: parsed, provider: 'openai', model, questionId };
}

// ── FRQ Zod schemas ─────────────────────────────────────────

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
	totalPoints: z.number().int().min(2).describe('Sum of all part point values')
});

export type FRQQuestionData = z.infer<typeof FRQQuestion>;

export interface GenerateFRQResult {
	question: FRQQuestionData;
	provider: string;
	model: string;
	questionId?: string;
	cached?: boolean;
}

export async function generateFRQQuestion(opts: {
	className: string;
	unit?: string;
}): Promise<GenerateFRQResult> {
	const { className, unit } = opts;
	if (!className) throw new Error('className is required');

	let unitContext = '';
	let keywordsContext = '';
	let courseNotesContext = '';

	if (className && unit) {
		const ctx = getUnitContextData(className, unit);
		if (ctx) {
			unitContext = `\nUNIT CONTEXT: ${unit}\n${ctx.description}\nKey Topics: ${ctx.topics.join(', ')}\n`;
			if (ctx.keywords.length > 0) {
				keywordsContext = `\nREQUIRED KEYWORDS/CONSTRAINTS: ${ctx.keywords.join('; ')}\n*** Your FRQ MUST focus ONLY on these specific keywords and topics. ***\n`;
			}
			if (ctx.importantNotes) {
				courseNotesContext = `\nCOURSE-GUIDANCE: ${ctx.importantNotes}\n`;
			}
		}
	}

	const frqSpec = getFRQSpecData(className);

	let frqOverviewSection = '';
	let questionTypesSection = '';
	let rubricSection = '';
	let importantNotesSection = '';
	let taskVerbsSection = '';
	let universalErrorsSection = '';

	if (frqSpec) {
		if (frqSpec.frqOverview)
			frqOverviewSection = `\nFRQ EXAM OVERVIEW (use for point distribution and structure):\n${frqSpec.frqOverview}\n`;
		if (frqSpec.questionTypes)
			questionTypesSection = `\nKNOWN FRQ QUESTION TYPES FOR THIS COURSE (choose the most relevant for the unit):\n${frqSpec.questionTypes}\n`;
		if (frqSpec.rubricConventions)
			rubricSection = `\nRUBRIC CONVENTIONS (follow strictly):\n${frqSpec.rubricConventions}\n`;
		if (frqSpec.importantNotes)
			importantNotesSection = `\nCOURSE-SPECIFIC IMPORTANT NOTES:\n${frqSpec.importantNotes}\n`;
		if (frqSpec.globalTaskVerbs)
			taskVerbsSection = `\nAP TASK VERB DEFINITIONS (use the correct verb and match the expected depth of response):\n${frqSpec.globalTaskVerbs}\n`;
		if (frqSpec.universalErrors)
			universalErrorsSection = `\nUNIVERSAL AP FRQ ERRORS TO AVOID in your generated question, scoring criteria, and model answers:\n${frqSpec.universalErrors}\n`;
	}

	const systemPrompt = `You are an expert AP exam question writer. Create a College Board–style Free Response Question (FRQ) for ${className}${unit ? `, ${unit}` : ''}.${unitContext}${keywordsContext}${courseNotesContext}${frqOverviewSection}${questionTypesSection}${rubricSection}${importantNotesSection}${taskVerbsSection}${universalErrorsSection}

CRITICAL UNIT SCOPE: Stay strictly within the specified unit's keywords and topics.

FRQ STRUCTURE:
- Write a main prompt/scenario (may include a stimulus such as a graph, data table, or passage in the "context" field)
- Include 2–4 sub-parts (a, b, c, d) in increasing difficulty
- Each sub-part must have a pointValue, scoringCriteria (what earns points), and a modelAnswer
- totalPoints must equal the sum of all part pointValues; use the exam overview above for realistic point distribution

QUALITY:
- Select a question type from the known types listed above that best fits the unit; mirror its common parts and depth
- Match authentic AP exam FRQ style and difficulty
- The first sub-part should be the easiest; each subsequent part increases in difficulty and builds logically on previous parts
- Scoring criteria must be specific, rubric-aligned, and unambiguous — use the rubric conventions above
- Model answers must be complete and earn full credit
- Use LaTeX for all math/science notation`;

	const userMessage = `Create an AP-level FRQ for ${className}${unit ? ` covering ${unit}` : ''}.`;

	const client = buildClient();
	const model = selectModelForClass(className);

	const completionParams: Parameters<typeof client.chat.completions.parse>[0] = {
		model,
		messages: [
			{ role: 'system', content: systemPrompt },
			{ role: 'user', content: userMessage }
		],
		response_format: zodResponseFormat(FRQQuestion, 'frq_question')
	};
	if (model === 'gpt-5-mini') {
		(completionParams as unknown as Record<string, unknown>).reasoning_effort = 'low';
	}

	const doneAiCall = logger.aiCall('generateFRQQuestion', model, { className, unit });
	let completion;
	try {
		completion = await client.chat.completions.parse(completionParams);
	} catch (err) {
		logger.error('[ai] generateFRQQuestion failed', { className, unit, model, error: err });
		throw err;
	}
	const msg = completion?.choices?.[0]?.message;
	if (!msg) throw new Error('No message returned from provider');
	if (msg.refusal) throw new Error('Content refused by provider');
	const parsed = msg.parsed;
	if (!parsed) throw new Error('No parsed output from structured response');
	doneAiCall({
		promptTokens: completion.usage?.prompt_tokens,
		completionTokens: completion.usage?.completion_tokens
	});

	return { question: parsed, provider: 'openai', model };
}

// ── FRQ Grading ─────────────────────────────────────────────

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

	const systemPrompt = `You are an experienced AP exam grader. Grade the following student FRQ response for ${className}${unit ? `, ${unit}` : ''} strictly and fairly according to the scoring criteria provided. Award partial credit where appropriate.`;

	const userMessage = `Grade the following FRQ attempt:\n\n${partsText}`;

	const client = buildClient();
	const model = 'gpt-4.1-mini';

	const doneAiCall = logger.aiCall('gradeFRQResponse', model, { className, unit });
	let completion;
	try {
		completion = await client.chat.completions.parse({
			model,
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: userMessage }
			],
			response_format: zodResponseFormat(FRQGradeResult, 'frq_grade')
		});
	} catch (err) {
		logger.error('[ai] gradeFRQResponse failed', { className, unit, model, error: err });
		throw err;
	}
	const msg = completion?.choices?.[0]?.message;
	if (!msg) throw new Error('No message returned from provider');
	if (msg.refusal) throw new Error('Content refused by provider');
	const parsed = msg.parsed;
	if (!parsed) throw new Error('No parsed output from structured response');
	doneAiCall({
		promptTokens: completion.usage?.prompt_tokens,
		completionTokens: completion.usage?.completion_tokens
	});

	return { grade: parsed, provider: 'openai', model };
}
