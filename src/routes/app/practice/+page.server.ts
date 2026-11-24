import type { PageServerLoad } from './$types';
import { isFrqPracticeEnabled } from '#lib/flags.js';
import { getFrqCourseNames } from '#lib/question-bank/frq/profiles.server.js';
import { resolveSharedQuizForUser } from '#lib/shared-practice/shared-sets.server.js';

export const load: PageServerLoad = async ({ url, locals, parent, cookies }) => {
	const sharedSlug = url.searchParams.get('shared')?.trim() ?? '';
	const { activeOrganization } = await parent();
	const [frqEnabled, sharedResult] = await Promise.all([
		isFrqPracticeEnabled(),
		sharedSlug
			? resolveSharedQuizForUser(sharedSlug, locals.userId!, activeOrganization?.id ?? null)
			: Promise.resolve(null)
	]);
	const sharedQuiz = sharedResult?.status === 'ready' ? sharedResult.quiz : null;

	return {
		defaultPracticeMode: cookies.get('practice_default_mode') === 'frq' ? 'frq' : 'mcq',
		showQuizTimer: cookies.get('practice_hide_quiz_timer') !== '1',
		defaultQuizCount: Math.max(1, Math.min(50, Number(cookies.get('practice_quiz_count')) || 10)),
		frqEnabled,
		frqCourses: getFrqCourseNames(),
		sharedQuiz,
		sharedQuizError:
			sharedResult && sharedResult.status !== 'ready'
				? 'This shared quiz is no longer available.'
				: null
	};
};
