export const coachComposerActionIds = [
	'practice-question',
	'study-next',
	'study-plan',
	'review-progress'
] as const;

export type CoachComposerActionId = (typeof coachComposerActionIds)[number];

export type CoachComposerAction = {
	id: CoachComposerActionId;
	title: string;
	description: string;
	instruction: string;
};

export const coachComposerActions: CoachComposerAction[] = [
	{
		id: 'practice-question',
		title: 'Practice question',
		description: 'Quiz me on a weak unit',
		instruction:
			'The student selected Practice question. Use give_practice_question to serve an inline practice question unless they asked for something else.'
	},
	{
		id: 'study-next',
		title: 'Study next',
		description: 'Based on your progress',
		instruction:
			'The student selected Study next. Read their progress and insights, then recommend the best next study focus.'
	},
	{
		id: 'study-plan',
		title: 'Study plan',
		description: 'Plan the rest of this week',
		instruction:
			'The student selected Study plan. Review their goals and progress, then help build or update a study plan.'
	},
	{
		id: 'review-progress',
		title: 'Review progress',
		description: 'Summarize how you are doing',
		instruction:
			'The student selected Review progress. Summarize their AP practice performance across classes and units.'
	}
];

export function isCoachComposerActionId(value: string): value is CoachComposerActionId {
	return (coachComposerActionIds as readonly string[]).includes(value);
}

export function coachComposerActionInstructions(actionIds: CoachComposerActionId[]): string {
	return actionIds
		.map((id) => coachComposerActions.find((action) => action.id === id)?.instruction)
		.filter((instruction): instruction is string => Boolean(instruction))
		.join('\n');
}

export function formatCoachComposerMessage(
	text: string,
	actionIds: CoachComposerActionId[]
): string {
	const trimmed = text.trim();
	if (trimmed) return trimmed;
	if (!actionIds.length) return '';
	return actionIds
		.map((id) => coachComposerActions.find((action) => action.id === id)?.title)
		.filter((title): title is string => Boolean(title))
		.join(', ');
}
