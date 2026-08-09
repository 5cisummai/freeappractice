import { PublicFrqQuestionSchema, type PublicFrqQuestion } from '$lib/frq/types';

export const FRQ_DRAFT_VERSION = 1 as const;
export const FRQ_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const MAX_RESPONSE_SECTIONS = 12;
const MAX_SECTION_RESPONSE_CHARS = 12_000;
const MAX_TOTAL_RESPONSE_CHARS = 40_000;

export type FrqDraftResponses = Record<string, string>;
export type FrqLatestDraft = {
	question: PublicFrqQuestion;
	responses: FrqDraftResponses;
};

type DraftEnvelope = {
	version: typeof FRQ_DRAFT_VERSION;
	savedAt: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function parseEnvelope(value: unknown, now: number): DraftEnvelope | null {
	if (!isRecord(value) || value.version !== FRQ_DRAFT_VERSION) return null;
	if (
		typeof value.savedAt !== 'number' ||
		!Number.isSafeInteger(value.savedAt) ||
		value.savedAt > now + 5 * 60 * 1000 ||
		now - value.savedAt > FRQ_DRAFT_MAX_AGE_MS
	) {
		return null;
	}
	return { version: FRQ_DRAFT_VERSION, savedAt: value.savedAt };
}

function parseResponses(
	value: unknown,
	sectionIds?: ReadonlySet<string>
): FrqDraftResponses | null {
	if (!isRecord(value)) return null;
	const entries = Object.entries(value);
	if (entries.length > MAX_RESPONSE_SECTIONS) return null;

	let totalLength = 0;
	const responses: FrqDraftResponses = {};
	for (const [sectionId, response] of entries) {
		if (!sectionId || (sectionIds && !sectionIds.has(sectionId))) return null;
		if (typeof response !== 'string' || response.length > MAX_SECTION_RESPONSE_CHARS) return null;
		totalLength += response.length;
		if (totalLength > MAX_TOTAL_RESPONSE_CHARS) return null;
		responses[sectionId] = response;
	}
	return responses;
}

function readStoredValue(raw: string | null): unknown | null {
	if (!raw) return null;
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

export function parseFrqQuestionDraft(
	raw: string | null,
	question: Pick<PublicFrqQuestion, 'questionId' | 'sections'>,
	now = Date.now()
): FrqDraftResponses | null {
	const value = readStoredValue(raw);
	if (!isRecord(value) || parseEnvelope(value, now) === null) return null;
	if (value.questionId !== question.questionId) return null;
	return parseResponses(value.responses, new Set(question.sections.map((section) => section.id)));
}

export function parseFrqLatestDraft(
	raw: string | null,
	context: { apClass: string; unit?: string },
	now = Date.now()
): FrqLatestDraft | null {
	const value = readStoredValue(raw);
	if (!isRecord(value) || parseEnvelope(value, now) === null) return null;

	const questionResult = PublicFrqQuestionSchema.safeParse(value.question);
	if (!questionResult.success) return null;
	const question = questionResult.data;
	if (question.apClass !== context.apClass || (context.unit && question.unit !== context.unit)) {
		return null;
	}

	const responses = parseResponses(
		value.responses,
		new Set(question.sections.map((section) => section.id))
	);
	return responses ? { question, responses } : null;
}

export function serializeFrqQuestionDraft(
	question: Pick<PublicFrqQuestion, 'questionId' | 'sections'>,
	responses: FrqDraftResponses,
	now = Date.now()
): string {
	return JSON.stringify({
		version: FRQ_DRAFT_VERSION,
		savedAt: now,
		questionId: question.questionId,
		responses
	});
}

export function serializeFrqLatestDraft(
	question: PublicFrqQuestion,
	responses: FrqDraftResponses,
	now = Date.now()
): string {
	return JSON.stringify({
		version: FRQ_DRAFT_VERSION,
		savedAt: now,
		question,
		responses
	});
}
