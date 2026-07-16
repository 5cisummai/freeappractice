import { resolveEffectiveUnit } from '$lib/catalog/ap-classes';
import type { GeneratedQuestion, QuestionOption } from '$lib/questions/types';

export { resolveEffectiveUnit };

export type QuestionApiResponse = Record<string, unknown> & {
	error?: string;
	questionId?: string;
	answer?: unknown;
};

function parseParagraphs(value: unknown): string[] {
	if (typeof value !== 'string') return [];
	const lines = value.split('\n');
	const segments: string[] = [];
	let current: string[] = [];
	let inFence = false;
	let fenceChar = '';
	let fenceLen = 0;
	for (const line of lines) {
		if (!inFence) {
			const m = line.match(/^[ \t]*(`{3,}|~{3,})/);
			if (m) {
				inFence = true;
				fenceChar = m[1][0];
				fenceLen = m[1].length;
				current.push(line);
			} else if (line.trim() === '' && current.length > 0) {
				segments.push(current.join('\n').trim());
				current = [];
			} else {
				current.push(line);
			}
		} else {
			const closeRe = new RegExp(`^[ \\t]*\\${fenceChar}{${fenceLen},}[ \\t]*$`);
			current.push(line);
			if (closeRe.test(line)) inFence = false;
		}
	}
	if (current.length > 0) segments.push(current.join('\n').trim());
	return segments.filter(Boolean);
}

function extractCorrectLetter(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	const upper = value.toUpperCase();
	// Prefer a standalone A–D token so phrases like "answer is C" do not match the A in "ANSWER".
	const standalone = upper.match(/\b([A-D])\b/);
	return standalone?.[1];
}

function normalizeOptions(value: unknown): QuestionOption[] {
	if (Array.isArray(value)) {
		return value
			.slice(0, 4)
			.map((entry, index) => {
				if (typeof entry === 'string') {
					const letter = String.fromCharCode(65 + index);
					return { id: letter, label: letter, text: entry };
				}
				if (entry && typeof entry === 'object') {
					const obj = entry as Record<string, unknown>;
					const id = String(obj.id ?? obj.label ?? String.fromCharCode(65 + index)).toUpperCase();
					const label = id;
					const text = String(obj.text ?? obj.value ?? '');
					return { id, label, text };
				}
				return null;
			})
			.filter((entry): entry is QuestionOption => Boolean(entry && entry.text));
	}

	if (!value || typeof value !== 'object') return [];

	const obj = value as Record<string, unknown>;
	return ['A', 'B', 'C', 'D']
		.map((letter) => {
			const text = obj[`option${letter}`];
			if (typeof text !== 'string' || !text.trim()) return null;
			return { id: letter, label: letter, text: text.trim() };
		})
		.filter((entry): entry is QuestionOption => Boolean(entry));
}

function resolveQuestionId(payload: unknown, questionIdFromApi?: string): string | undefined {
	const fromApi =
		typeof questionIdFromApi === 'string' && questionIdFromApi.trim()
			? questionIdFromApi.trim()
			: undefined;
	if (!payload || typeof payload !== 'object') return fromApi;

	const inner = String((payload as Record<string, unknown>).questionId ?? '').trim();
	return inner || fromApi;
}

function normalizeQuestionPayload(
	payload: unknown,
	questionIdFromApi?: string
): GeneratedQuestion | null {
	if (!payload || typeof payload !== 'object') return null;

	const obj = payload as Record<string, unknown>;
	const prompt = String(obj.question ?? obj.prompt ?? '').trim();
	if (!prompt) return null;

	const optionsFromObject = normalizeOptions(obj);
	const options = optionsFromObject.length > 0 ? optionsFromObject : normalizeOptions(obj.options);
	if (options.length < 2) return null;

	const stimulus = String(obj.stimulus ?? obj.passage ?? obj.context ?? '').trim();
	const hasStimulus = stimulus.length > 0;

	return {
		questionId: resolveQuestionId(obj, questionIdFromApi),
		topic: String(obj.topicsCovered ?? '').trim() || undefined,
		prompt,
		options,
		correctAnswer: extractCorrectLetter(obj.correctAnswer ?? obj.answer),
		explanation: String(obj.explanation ?? obj.rationale ?? '').trim() || undefined,
		hint1: String(obj.hint1 ?? '').trim() || undefined,
		hint2: String(obj.hint2 ?? '').trim() || undefined,
		leftPanel: hasStimulus ? { title: 'Stimulus', content: parseParagraphs(stimulus) } : undefined,
		rightPanel: hasStimulus ? { title: 'Prompt', content: parseParagraphs(prompt) } : undefined,
		hasStimulus
	};
}

export function parseQuestionPayloadFromResponse(response: QuestionApiResponse): GeneratedQuestion {
	if (typeof response.error === 'string' && response.error.trim()) {
		throw new Error(response.error);
	}

	let payload: unknown = response;
	if (typeof response.answer === 'string') {
		let raw = response.answer.trim();
		if (raw.startsWith('```')) {
			raw = raw.replace(/```json|```/g, '').trim();
		}
		try {
			payload = JSON.parse(raw);
		} catch {
			throw new Error('Question service returned an invalid question payload.');
		}
	}

	const normalized = normalizeQuestionPayload(payload, String(response.questionId ?? ''));
	if (!normalized) {
		throw new Error('Question API response was missing required fields.');
	}
	return normalized;
}
