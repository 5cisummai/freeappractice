import { apiFetch, getResponseMessage, readJsonOrNull } from '#lib/client/api.js';
import type {
	CoachPracticeQuestionOutput,
	CoachPracticeQuestionToolInput
} from '#lib/agent/tools/practice.js';

export const COACH_PRACTICE_QUESTION_TIMEOUT_MS = 20_000;

type PracticeQuestionResponse = {
	question?: CoachPracticeQuestionOutput;
	error?: string;
	retryAfterSeconds?: number;
};

export type FetchCoachPracticeQuestionOptions = {
	signal?: AbortSignal;
	timeoutMs?: number;
};

function retryAfterSecondsFrom(payload: PracticeQuestionResponse | null): number | undefined {
	const value = payload?.retryAfterSeconds;
	if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined;
	return value;
}

export async function fetchCoachPracticeQuestion(
	input: CoachPracticeQuestionToolInput,
	options: FetchCoachPracticeQuestionOptions = {}
): Promise<CoachPracticeQuestionOutput | { error: string; retryAfterSeconds?: number }> {
	const timeoutMs = options.timeoutMs ?? COACH_PRACTICE_QUESTION_TIMEOUT_MS;
	const timeoutSignal = AbortSignal.timeout(timeoutMs);
	const signal = options.signal ? AbortSignal.any([timeoutSignal, options.signal]) : timeoutSignal;

	try {
		const response = await apiFetch('/api/coach/practice-question', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(input),
			signal
		});
		const payload = await readJsonOrNull<PracticeQuestionResponse>(response);
		if (!response.ok || !payload?.question) {
			return {
				error: getResponseMessage(payload, 'Could not load a practice question right now.'),
				retryAfterSeconds: retryAfterSecondsFrom(payload)
			};
		}
		return payload.question;
	} catch {
		if (options.signal?.aborted) {
			return { error: 'Could not load a practice question. Check your connection and try again.' };
		}
		if (signal.aborted && signal.reason instanceof Error && signal.reason.name === 'TimeoutError') {
			return { error: 'The practice question took too long to load. Try again.' };
		}
		return { error: 'Could not load a practice question. Check your connection and try again.' };
	}
}
