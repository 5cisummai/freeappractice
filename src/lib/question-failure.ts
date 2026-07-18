/** Shared failure taxonomy for question request analytics (client + server). */
export type QuestionFailureKind =
	| 'validation'
	| 'generation'
	| 'busy'
	| 'network'
	| 'unknown';

/** Map an HTTP status from a question API response to a failure kind. */
export function classifyQuestionFailureFromStatus(
	status: number | null | undefined
): QuestionFailureKind {
	if (status == null || status === 0) return 'network';
	if (status === 503) return 'busy';
	if (status >= 500) return 'generation';
	if (status >= 400) return 'validation';
	return 'unknown';
}
