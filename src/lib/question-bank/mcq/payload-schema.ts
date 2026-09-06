import { z } from 'zod';
import { resolveQuestionMainTopic } from '$lib/question-bank/main-topic';

const LETTERS = ['A', 'B', 'C', 'D'] as const;

export const StimulusProvenanceSchema = z.enum(['ai-generated-original', 'legacy-unknown']);

export const StimulusSchema = z
	.object({
		text: z.string().max(20_000).nullable().default(null),
		diagramSpec: z.record(z.string(), z.unknown()).nullable().default(null),
		provenance: StimulusProvenanceSchema.default('legacy-unknown')
	})
	.superRefine((value, ctx) => {
		if (!value.text && !value.diagramSpec) {
			ctx.addIssue({ code: 'custom', message: 'Stimulus must contain text or a diagram.' });
		}
	});

export const McqQuestionPayloadSchema = z.object({
	apClass: z.string().trim().min(1),
	unit: z.string().trim().min(1).default('all-units'),
	mainTopic: z.string().trim().min(1),
	topicsCovered: z.string().default(''),
	question: z.string().min(1),
	diagramSpec: z.record(z.string(), z.unknown()).nullable().default(null),
	hasDiagram: z.boolean().default(false),
	optionA: z.string().default(''),
	optionB: z.string().default(''),
	optionC: z.string().default(''),
	optionD: z.string().default(''),
	correctAnswer: z.enum(LETTERS),
	explanation: z.string().default(''),
	stimulus: StimulusSchema.nullable().default(null),
	stimulusId: z.string().uuid().nullable().default(null),
	stimulusPosition: z.number().int().nonnegative().nullable().default(null),
	stimulusQuestionCount: z.number().int().positive().nullable().default(null)
});

export type McqQuestionPayload = z.infer<typeof McqQuestionPayloadSchema>;

function asText(value: unknown): string {
	return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function asDiagramSpec(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	return value as Record<string, unknown>;
}

function asStimulus(
	value: unknown,
	record: Record<string, unknown>
): z.infer<typeof StimulusSchema> | null {
	if (value && typeof value === 'object' && !Array.isArray(value)) {
		const candidate = value as Record<string, unknown>;
		const text = typeof candidate.text === 'string' ? candidate.text.trim() : '';
		const diagramSpec = asDiagramSpec(candidate.diagramSpec ?? candidate.diagram);
		if (text || diagramSpec) {
			return {
				text: text || null,
				diagramSpec,
				provenance:
					candidate.provenance === 'ai-generated-original'
						? 'ai-generated-original'
						: 'legacy-unknown'
			};
		}
	}
	const legacyText = record.stimulus ?? record.passage ?? record.context;
	if (typeof legacyText === 'string' && legacyText.trim()) {
		return { text: legacyText.trim(), diagramSpec: null, provenance: 'legacy-unknown' };
	}
	return null;
}

function asUuid(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	return z.string().uuid().safeParse(value.trim()).success ? value.trim() : null;
}

function asNullableInteger(value: unknown, minimum = 0): number | null {
	return typeof value === 'number' && Number.isInteger(value) && value >= minimum ? value : null;
}

function asCorrectAnswer(value: unknown): unknown {
	if (typeof value !== 'string') return value;
	const upper = value.trim().toUpperCase();
	if (upper === 'A' || upper === 'B' || upper === 'C' || upper === 'D') return upper;
	return upper.match(/\b([A-D])\b/)?.[1] ?? value;
}

function optionsFromLegacy(record: Record<string, unknown>): {
	optionA: string;
	optionB: string;
	optionC: string;
	optionD: string;
} {
	const fromFields = {
		optionA: asText(record.optionA),
		optionB: asText(record.optionB),
		optionC: asText(record.optionC),
		optionD: asText(record.optionD)
	};
	if (fromFields.optionA || fromFields.optionB || fromFields.optionC || fromFields.optionD) {
		return fromFields;
	}

	const options = record.options;
	if (!Array.isArray(options)) return fromFields;
	const texts = options.slice(0, 4).map((entry) => {
		if (typeof entry === 'string') return entry;
		if (entry && typeof entry === 'object') {
			const obj = entry as Record<string, unknown>;
			return asText(obj.text ?? obj.value);
		}
		return '';
	});
	return {
		optionA: texts[0] ?? '',
		optionB: texts[1] ?? '',
		optionC: texts[2] ?? '',
		optionD: texts[3] ?? ''
	};
}

/** Parse a stored MCQ JSONB payload, filling fields older rows omit. */
export function parseMcqQuestionPayload(data: unknown): McqQuestionPayload {
	const record =
		data && typeof data === 'object' && !Array.isArray(data)
			? (data as Record<string, unknown>)
			: {};
	const topicsCovered = asText(record.topicsCovered);
	const diagramSpec = asDiagramSpec(record.diagramSpec ?? record.diagram);
	const hasDiagram =
		typeof record.hasDiagram === 'boolean' ? record.hasDiagram : Boolean(diagramSpec);
	const stimulus = asStimulus(record.stimulus, record);
	const stimulusId = asUuid(record.stimulusId);
	const stimulusPosition = asNullableInteger(record.stimulusPosition);
	const stimulusQuestionCount = asNullableInteger(record.stimulusQuestionCount, 1);

	return McqQuestionPayloadSchema.parse({
		apClass: asText(record.apClass).trim() || 'Unknown',
		unit: asText(record.unit).trim() || undefined,
		topicsCovered,
		mainTopic:
			resolveQuestionMainTopic(
				typeof record.mainTopic === 'string' ? record.mainTopic : '',
				topicsCovered
			) || 'Legacy topic',
		question: asText(record.question ?? record.prompt),
		diagramSpec,
		hasDiagram,
		...optionsFromLegacy(record),
		correctAnswer: asCorrectAnswer(record.correctAnswer ?? record.answer),
		explanation: asText(record.explanation ?? record.rationale),
		stimulus,
		stimulusId,
		stimulusPosition,
		stimulusQuestionCount
	});
}
