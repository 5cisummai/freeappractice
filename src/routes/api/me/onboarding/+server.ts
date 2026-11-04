import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { readJsonBody, RequestBodyTooLargeError } from '#lib/server/request-body.server.js';
import { completeOnboarding } from '#lib/users/onboarding.server.js';
import {
	ONBOARDING_COOKIE_NAME,
	ONBOARDING_INTENT_COOKIE_NAME,
	ONBOARDING_PENDING_COOKIE_OPTIONS,
	readOnboardingState,
	serializeCompletedOnboarding
} from '#lib/onboarding.js';

export const GET = withAuthedHandler(
	async (event) => Response.json(readOnboardingState(event.cookies.get(ONBOARDING_COOKIE_NAME))),
	{ logLabel: 'Onboarding state error', errorMessage: 'Failed to load onboarding state' }
);

export const POST = withAuthedHandler(
	async (event, userId) => {
		let body: unknown;
		try {
			body = await readJsonBody(event.request, 16 * 1024);
		} catch (error) {
			return Response.json(
				{ error: 'Invalid onboarding request.' },
				{ status: error instanceof RequestBodyTooLargeError ? 413 : 400 }
			);
		}
		if (
			!body ||
			typeof body !== 'object' ||
			!('courses' in body) ||
			!Array.isArray(body.courses) ||
			!('goals' in body) ||
			!Array.isArray(body.goals)
		)
			return Response.json({ error: 'Courses and goals must be arrays.' }, { status: 400 });
		const result = await completeOnboarding(userId, { courses: body.courses, goals: body.goals });
		if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
		event.cookies.set(
			ONBOARDING_COOKIE_NAME,
			serializeCompletedOnboarding(result.state.goals),
			ONBOARDING_PENDING_COOKIE_OPTIONS
		);
		event.cookies.delete(ONBOARDING_INTENT_COOKIE_NAME, { path: '/' });
		return Response.json({ courses: result.courses, state: result.state });
	},
	{ logLabel: 'Complete onboarding error', errorMessage: 'Failed to complete onboarding' }
);
