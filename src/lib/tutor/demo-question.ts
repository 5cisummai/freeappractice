/** Stable id for the landing-page tutor demo. Not a Neon row. */
export const DEMO_TUTOR_QUESTION_ID = '11111111-1111-4111-8111-111111111111';

export const DEMO_TUTOR_QUESTION = {
	id: DEMO_TUTOR_QUESTION_ID,
	question: 'Which process occurs in the thylakoid membrane during photosynthesis?',
	optionA: 'Krebs cycle',
	optionB: 'Light reactions',
	optionC: 'Glycolysis',
	optionD: 'Calvin cycle',
	correctAnswer: 'B' as const,
	explanation:
		'Light reactions happen in the thylakoid membrane, where chlorophyll absorbs photons and splits water. Krebs cycle and glycolysis happen in other compartments. The Calvin cycle occurs in the stroma.',
	apClass: 'AP Biology',
	unit: 'Unit 3: Cellular Energetics',
	hasDiagram: false,
	createdAt: '2026-01-01T00:00:00.000Z'
};

export function isDemoTutorQuestionId(questionId: string) {
	return questionId.trim() === DEMO_TUTOR_QUESTION_ID;
}
