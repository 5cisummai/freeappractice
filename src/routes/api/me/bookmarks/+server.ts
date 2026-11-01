import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { getBookmarkedQuestions, toggleBookmark } from '#lib/users/bookmarks.server.js';
import { capturePostHogServerEvent } from '#lib/server/posthog.js';
import {
	requirePracticeSession,
	resolvePracticeContext
} from '#lib/users/practice-context.server.js';
import { OrganizationPermissionError } from '#lib/auth/organization-types.js';

export const GET = withAuthedHandler(
	async (event, userId) => {
		const organizationId = event.url.searchParams.get('organizationId');
		let context = { organizationId: null as string | null };
		try {
			context = await resolvePracticeContext(userId, organizationId);
		} catch (error) {
			if (error instanceof OrganizationPermissionError) {
				return Response.json({ error: error.message }, { status: 403 });
			}
			throw error;
		}
		const questions = await getBookmarkedQuestions(userId, context);
		return Response.json({ bookmarks: questions });
	},
	{ logLabel: 'Get bookmarks error', errorMessage: 'Failed to fetch bookmarks' }
);

export const POST = withAuthedHandler(
	async (event, userId) => {
		const body = await event.request.json().catch(() => null);
		const questionId = body && typeof body === 'object' ? body.questionId : null;
		const organizationId = body && typeof body === 'object' ? body.organizationId : null;
		const practiceSessionId =
			body && typeof body === 'object' && typeof body.practiceSessionId === 'string'
				? body.practiceSessionId
				: '';
		if (!questionId || typeof questionId !== 'string') {
			return Response.json({ error: 'questionId is required' }, { status: 400 });
		}

		let context = { organizationId: null as string | null };
		try {
			if (practiceSessionId) {
				const session = await requirePracticeSession(userId, practiceSessionId);
				context.organizationId = session.organizationId;
			} else {
				context = await resolvePracticeContext(
					userId,
					typeof organizationId === 'string' ? organizationId : null
				);
			}
		} catch (error) {
			if (error instanceof OrganizationPermissionError) {
				return Response.json({ error: error.message }, { status: 403 });
			}
			throw error;
		}

		const bookmarked = await toggleBookmark(userId, questionId, context);
		capturePostHogServerEvent(event.request, {
			distinctId: userId,
			event: 'question_bookmark_toggled',
			properties: {
				question_id: questionId,
				bookmarked
			}
		});

		return Response.json({
			message: bookmarked ? 'Bookmark added' : 'Bookmark removed',
			bookmarked
		});
	},
	{ logLabel: 'Bookmark error', errorMessage: 'Failed to bookmark question' }
);
