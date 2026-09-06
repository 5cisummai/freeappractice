import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AP_DATA } from '$lib/data/ap-data';
import { MCQ_GENERATION_MODEL } from '$lib/ai/ai-models-config';
import { EXAMFIG_DIAGRAM_SKILL } from '$lib/ai/examfig-skill';
import { structuredObject } from '$lib/ai/service.server';
import { examfigTools } from '$lib/ai/tools/examfig.server';
import { validateExamfigDiagram } from '$lib/ai/examfig.server';
import { assertOpenAiCompatibleObjectSchema } from '$lib/ai/openai-structured-schema';
import {
	getStimulusPolicy,
	isStimulusPolicyEnabledForUnit
} from '$lib/question-bank/mcq/stimulus-policy';

/**
 * MCQ generation: prompts, structured AI calls, and generation metrics.
 */
interface UnitContext {
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

/** Exact apClass + unit label → generation controls from the unified catalog. */
const unitContextByKey: ReadonlyMap<string, UnitContext> = (() => {
	const map = new Map<string, UnitContext>();
	for (const course of AP_DATA.courses) {
		for (const unit of course.units) {
			map.set(unitContextKey(course.name, unit.label), {
				topics: [...unit.generation.mcq.keywords],
				keywords: [...unit.generation.mcq.constraints]
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
		unitContext: `\nUNIT FOCUS: ${unit}\n${ctx.topics.length ? `MAIN TOPIC OPTIONS (choose exactly one for the required mainTopic field): ${ctx.topics.join(', ')}\n` : ''}`,
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

const APStimulusQuestion = z.object({ ...APQuestionFields });
const APStimulusSet = z.object({
	stimulus: z.object({
		text: z.string().max(20_000).nullable(),
		diagram: z.string().max(100_000).nullable()
	}),
	questions: z.array(APStimulusQuestion).min(1).max(5)
});

assertOpenAiCompatibleObjectSchema(APStimulusSet, { schemaName: 'ap_stimulus_set' });

export type APStimulusQuestionData = z.infer<typeof APStimulusQuestion>;
export type APStimulusSetData = z.infer<typeof APStimulusSet>;

/** Exported for OpenAI schema compatibility tests. */
export const apQuestionSchema = APQuestion;
export const apStimulusSetSchema = APStimulusSet;

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

export function parseGeneratedApStimulusSet(
	input: unknown,
	expectedChildCount?: number
): APStimulusSetData & { diagram: Record<string, unknown> | null } {
	const parsed = APStimulusSet.parse(input);
	if (expectedChildCount !== undefined && parsed.questions.length !== expectedChildCount) {
		throw new Error(
			`Generated stimulus set contained ${parsed.questions.length} questions; expected ${expectedChildCount}.`
		);
	}
	if (!parsed.stimulus.text && !parsed.stimulus.diagram) {
		throw new Error('Generated stimulus must contain text or a diagram.');
	}

	let diagram: Record<string, unknown> | null = null;
	if (parsed.stimulus.diagram !== null) {
		try {
			diagram = z.record(z.string(), z.unknown()).parse(JSON.parse(parsed.stimulus.diagram));
		} catch (error) {
			throw new Error('Generated stimulus diagram was not valid JSON.', { cause: error });
		}
	}
	return { ...parsed, diagram };
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

/** JSON Schema for batch generation of a shared-stimulus set. */
export function apStimulusSetJsonSchema(): Record<string, unknown> {
	const schema = z.toJSONSchema(APStimulusSet) as Record<string, unknown>;
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

export interface GenerateStimulusSetResult {
	answer: APStimulusSetData & { diagram: Record<string, unknown> | null };
	provider: string;
	model: string;
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

	const diagramSection = diagramsEnabled ? `\n${EXAMFIG_DIAGRAM_SKILL}` : '';

	const systemPrompt = `You are an independent AP-aligned practice question writer. Create one original, high-quality practice question for the requested AP course and unit. Do not reproduce or closely imitate any official question, passage, stimulus, rubric, or scoring guidance.

COURSE AND UNIT SCOPE:
${unitContext}${keywordsContext}${diversitySection}
- Stay strictly within the app-authored keywords and focus controls listed above.
- Do not incorporate concepts from other units, even if they seem related.

${diagramSection}

QUESTION QUALITY:
- Test understanding through application, analysis, evaluation, or carefully chosen recall.
- Use a medium AP-level difficulty and a clear, independent scenario.
- Include plausible distractors based on common misconceptions.
- Keep answer choices roughly equal in length.
- Do not use "all of the above" or "none of the above".

WRITING AND FORMATTING:
- For ALL math and science notation use LaTeX with these exact delimiters ONLY: $...$ for inline math, $$...$$ for display (block) math. Do NOT use \\(...\\), \\[...\\], \\begin{equation}, \\begin{align}, or any other LaTeX environment delimiters — they will not render.
- For code blocks use the triple backtick syntax (\`\`\`) to enclose code.
- Explain why the correct answer is right and why each distractor is incorrect.
- Use a newline before each option letter (A, B, C, D) when discussing them
- Be concise and avoid unnecessary repetition.

OUTPUT CONTRACT:
- Return only the JSON object matching the supplied schema.
- Do not include markdown, commentary, or text before or after the JSON.`;

	const userMessage = `Create an AP-level practice question for ${className}${unit ? ` covering ${unit}` : ''}.\n\nReturn ONLY the JSON object, no other text.`;

	return { system: systemPrompt, user: userMessage };
}

export function buildStimulusSetGenerationPrompt(opts: {
	className: string;
	unit?: string;
	childCount: number;
	mode: 'text' | 'diagram' | 'mixed';
	recentTopics?: string[];
	allowedDiagramTypes?: string[];
}): { system: string; user: string } {
	const { className, unit, childCount, mode, recentTopics } = opts;
	if (!className) throw new Error('className is required');
	if (!Number.isInteger(childCount) || childCount < 1 || childCount > 5) {
		throw new Error('childCount must be an integer between 1 and 5');
	}
	const { unitContext, keywordsContext } = buildUnitSections(className, unit, 'question');
	const diversitySection = buildDiversitySection(recentTopics, {
		label: 'TOPICS',
		avoidLabel: 'subtopic, concept, or scenario',
		pickLabel: 'Choose a fresh angle that is distinct from the listed topics.'
	});
	const modeInstruction =
		mode === 'text'
			? 'STIMULUS FORMAT: Provide a substantive text stimulus.'
			: mode === 'diagram'
				? 'STIMULUS FORMAT: Provide a semantic Examfig DiagramSpec encoded as JSON in stimulus.diagram. Supporting text in stimulus.text is allowed.'
				: 'STIMULUS FORMAT: Provide both a text stimulus and a semantic Examfig DiagramSpec.';
	const diagramSection = mode === 'text' ? '' : `\n${EXAMFIG_DIAGRAM_SKILL}`;
	const allowedDiagramTypes =
		opts.allowedDiagramTypes ?? getStimulusPolicy(className).profiles[0]?.diagramTypes ?? [];
	const diagramPolicy =
		mode === 'text'
			? ''
			: `\nCOURSE-SPECIFIC DIAGRAM POLICY:\n- Allowed diagram types for ${className}: ${allowedDiagramTypes.join(', ')}\n- Use only one of these allowed types. Do not select any other type from the general Examfig reference.`;
	const system = `You write AP-aligned multiple-choice stimulus sets for ${className}. Create exactly ${childCount} independently answerable questions that share one stimulus. Do not reproduce or closely imitate official questions, passages, quotations, documents, authors, dates, or attributions.

COURSE AND UNIT SCOPE:
${unitContext}${keywordsContext}${diversitySection}
- Keep every child strictly inside the selected unit and the app-authored keywords and focus controls above.
- Every question must be answerable without seeing another question or its answer.

${modeInstruction}
${diagramPolicy}
${diagramSection}

QUESTION QUALITY:
- Use a medium AP-level difficulty and test application, analysis, evaluation, or carefully chosen recall.
- Make distractors plausible and based on common misconceptions.
- Keep child questions concise when a diagram carries the relevant relationships or values.

WRITING AND FORMATTING:
- For ALL math and science notation use LaTeX with these exact delimiters ONLY: $...$ for inline math, $$...$$ for display math. Do not use other LaTeX delimiters or environments.
- Use factual real-world context when it materially improves the stimulus, but write it in your own wording.
- Do not reproduce source wording, quotes, official questions, or distinctive narrative details.
- Prefer public facts, anonymized subjects, or clearly labeled composite scenarios.
- Do not invent allegations or damaging facts about identifiable living people.
- Do not fabricate official attributions or imply endorsement by a source or organization.

OUTPUT CONTRACT:
- Return only JSON matching the supplied strict schema.
- The stimulus diagram value is a JSON string or null, never a JSON object.
- Begin directly with the stimulus content. Do not add labels, titles, source disclaimers, or phrases such as "Original practice material" to stimulus.text.
- Do not include markdown, commentary, or text before or after the JSON.
`;
	const user = `Create a ${childCount}-question practice set for ${className}${unit ? ` covering ${unit}` : ''}. Return only the JSON object.`;
	return { system, user };
}

async function generateAPQuestionBody(opts: {
	className: string;
	unit?: string;
	recentTopics?: string[];
	diagramsEnabled?: boolean;
}): Promise<{ parsed: APQuestionData; model: string }> {
	const diagramsEnabled = opts.diagramsEnabled === true;
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

export async function generateAPStimulusSet(opts: {
	className: string;
	unit?: string;
	childCount: number;
	mode: 'text' | 'diagram' | 'mixed';
	recentTopics?: string[];
	stimulusQuestionsEnabled: boolean;
}): Promise<GenerateStimulusSetResult> {
	if (!opts.stimulusQuestionsEnabled) {
		throw new Error('Stimulus question generation is disabled.');
	}
	const policy = getStimulusPolicy(opts.className);
	const profile = policy.profiles[0];
	if (
		!policy.setsEnabled ||
		!isStimulusPolicyEnabledForUnit(policy, opts.unit) ||
		!profile ||
		!profile.allowedModes.includes(opts.mode) ||
		opts.childCount < profile.minChildren ||
		opts.childCount > profile.maxChildren
	) {
		throw new Error('Stimulus set does not match the course/unit policy.');
	}
	const generationStarted = Date.now();
	const { system, user } = buildStimulusSetGenerationPrompt({
		...opts,
		allowedDiagramTypes: profile.diagramTypes
	});
	const result = await structuredObject({
		callName: 'generateAPStimulusSet',
		model: MCQ_GENERATION_MODEL,
		system,
		user,
		schema: APStimulusSet,
		schemaName: 'ap_stimulus_set',
		reasoningEffort: 'medium',
		tools: opts.mode === 'text' ? undefined : examfigTools,
		logContext: {
			className: opts.className,
			unit: opts.unit,
			childCount: opts.childCount,
			mode: opts.mode
		}
	});
	const parsed = parseGeneratedApStimulusSet(result.parsed, opts.childCount);
	if (opts.mode === 'text' && parsed.diagram)
		throw new Error('Text stimulus unexpectedly included a diagram.');
	if (opts.mode === 'diagram' && !parsed.diagram)
		throw new Error('Diagram stimulus did not include a diagram.');
	if (opts.mode === 'mixed' && (!parsed.stimulus.text || !parsed.diagram)) {
		throw new Error('Mixed stimulus must include both text and a diagram.');
	}
	if (parsed.diagram) {
		if (!profile.diagramTypes.includes(String(parsed.diagram.type ?? ''))) {
			throw new Error('Generated stimulus diagram is not allowed for this course/unit.');
		}
		const validation = validateExamfigDiagram(parsed.diagram);
		if (!validation.valid) {
			throw new Error(
				`Generated stimulus diagram failed validation: ${validation.errors.join('; ')}`
			);
		}
	}
	return {
		answer: parsed,
		provider: 'ai',
		model: result.model,
		timing: { generationMs: Date.now() - generationStarted, persistenceMs: 0 }
	};
}

export async function generateAPQuestion(opts: {
	className: string;
	unit?: string;
	recentTopics?: string[];
	diagramsEnabled?: boolean;
}): Promise<GenerateResult> {
	const { className, unit } = opts;
	const generationStarted = Date.now();
	const { parsed, model } = await generateAPQuestionBody({
		className,
		unit,
		recentTopics: opts.recentTopics,
		diagramsEnabled: opts.diagramsEnabled
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
