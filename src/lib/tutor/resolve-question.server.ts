import { getQuestionById, type StoredQuestion } from '$lib/questions/storage.server';
import { DEMO_TUTOR_QUESTION, isDemoTutorQuestionId } from '$lib/tutor/demo-question';

export async function resolveTutorQuestion(questionId: string): Promise<StoredQuestion | null> {
	if (isDemoTutorQuestionId(questionId)) {
		return DEMO_TUTOR_QUESTION satisfies StoredQuestion;
	}
	return getQuestionById(questionId).catch(() => null);
}
