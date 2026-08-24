/** Persist a required mainTopic, copying topicsCovered when the dedicated field is missing. */
export function resolveQuestionMainTopic(
	mainTopic: string | null | undefined,
	topicsCovered: string | null | undefined
): string {
	return mainTopic?.trim() || topicsCovered?.trim() || '';
}
