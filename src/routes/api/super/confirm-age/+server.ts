import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { InvalidBirthDateError, UnderAgeError } from '#lib/auth/age.js';
import { confirmAge } from '#lib/agent/personalization/profile.server.js';
import { readJsonBody, RequestBodyTooLargeError } from '#lib/server/request-body.server.js';

function readBirthDate(body: unknown): string | undefined {
	if (!body || typeof body !== 'object' || !('birthDate' in body)) return undefined;
	const value = (body as { birthDate: unknown }).birthDate;
	return typeof value === 'string' ? value : undefined;
}

export const POST = withAuthedHandler(
	async (event, userId) => {
		try {
			const birthDate = readBirthDate(await readJsonBody(event.request, 1024));
			const profile = await confirmAge(userId, birthDate);
			return Response.json({ confirmed: true, ageConfirmedAt: profile.ageConfirmedAt });
		} catch (error) {
			if (error instanceof RequestBodyTooLargeError) {
				return Response.json({ error: 'Request body is too large' }, { status: 413 });
			}
			if (error instanceof SyntaxError) {
				return Response.json({ error: 'Enter a valid birth date.' }, { status: 400 });
			}
			if (error instanceof InvalidBirthDateError) {
				return Response.json({ error: error.message }, { status: 400 });
			}
			if (error instanceof UnderAgeError) {
				return Response.json({ error: error.message, underAge: true }, { status: 403 });
			}
			throw error;
		}
	},
	{ logLabel: 'Confirm Super tutor age error', errorMessage: 'Failed to confirm age' }
);
