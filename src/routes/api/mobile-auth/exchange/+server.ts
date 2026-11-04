import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { auth } from '#lib/auth/server.js';
import { isMobileOpaque, mobileHash } from '#lib/auth/mobile-handoff.server.js';
import { readJsonBody } from '#lib/server/request-body.server.js';

export const POST: RequestHandler = async ({ request }) => {
	let body: unknown;
	try {
		body = await readJsonBody(request, 1024);
	} catch {
		error(400, 'Invalid code exchange');
	}
	const { code, verifier } = (body ?? {}) as Record<string, unknown>;
	if (!isMobileOpaque(code) || !isMobileOpaque(verifier)) error(400, 'Invalid code exchange');
	const context = await auth.$context;
	const record = await context.internalAdapter.consumeVerificationValue(
		`mobile-handoff:${mobileHash(code)}`
	);
	if (!record || record.expiresAt.getTime() <= Date.now())
		error(400, 'Sign-in code expired or already used');
	const payload = JSON.parse(record.value) as { challenge: string; sessionToken: string };
	if (mobileHash(verifier) !== payload.challenge) error(400, 'Invalid code verifier');
	const browserSession = await context.internalAdapter.findSession(payload.sessionToken);
	if (!browserSession || browserSession.session.expiresAt.getTime() <= Date.now())
		error(401, 'Browser session expired');
	// A separate session lets native sign-out leave the website signed in.
	const session = await context.internalAdapter.createSession(browserSession.user.id);
	if (!session) error(500, 'Could not create mobile session');
	return Response.json(
		{ session, user: browserSession.user },
		{
			headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }
		}
	);
};
