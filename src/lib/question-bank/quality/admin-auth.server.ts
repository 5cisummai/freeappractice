import { env } from '$env/dynamic/private';
import { error, type RequestEvent } from '@sveltejs/kit';
import { isAdminUser } from '$lib/auth/admin.server';

export function requireQuestionQualityAdmin(event: RequestEvent): string {
	if (isAdminUser(event.locals.user)) return event.locals.user!.id;
	const token = env.QUESTION_QUALITY_ADMIN_TOKEN?.trim();
	const authorization = event.request.headers.get('authorization');
	if (token && authorization === `Bearer ${token}`) return 'question-quality-cli';
	throw error(403, 'Admin access required');
}
