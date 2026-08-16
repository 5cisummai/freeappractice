import { apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/api';
import type { CoachPracticeQuestionOutput } from '$lib/super/coach-practice-question';
import type { CoachPracticeQuestionToolInput } from '$lib/super/coach-practice-question';

type PracticeQuestionResponse = {
	question?: CoachPracticeQuestionOutput;
	error?: string;
	retryAfterSeconds?: number;
};

export async function fetchCoachPracticeQuestion(
	input: CoachPracticeQuestionToolInput
): Promise<CoachPracticeQuestionOutput | { error: string; retryAfterSeconds?: number }> {
	const response = await apiFetch('/api/coach/practice-question', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input)
	});
	const payload = await readJsonOrNull<PracticeQuestionResponse>(response);
	if (!response.ok || !payload?.question) {
		return {
			error: getResponseMessage(payload, 'Could not load a practice question right now.'),
			retryAfterSeconds: payload?.retryAfterSeconds
		};
	}
	return payload.question;
}
