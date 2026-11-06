import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { auth } from '#lib/auth/server.js';
import {
	mobileCode,
	mobileHash,
	MOBILE_CALLBACK,
	MOBILE_COOKIE,
	readMobileFlow
} from '#lib/auth/mobile-handoff.server.js';

export const GET: RequestHandler = async ({ cookies, request, setHeaders }) => {
	setHeaders({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
	const context = await auth.$context;
	const flow = readMobileFlow(cookies.get(MOBILE_COOKIE), context.secret);
	if (!flow) error(400, 'Mobile sign-in expired. Close this window and try again in the app.');
	const session = await auth.api.getSession({
		headers: request.headers,
		query: { disableCookieCache: true }
	});
	if (!session) redirect(303, '/login?redirect=%2Fapp%2Fmobile-auth');
	const code = mobileCode();
	await context.internalAdapter.createVerificationValue({
		identifier: `mobile-handoff:${mobileHash(code)}`,
		value: JSON.stringify({ challenge: flow.challenge, sessionToken: session.session.token }),
		expiresAt: new Date(Date.now() + 60_000)
	});
	cookies.delete(MOBILE_COOKIE, { path: '/' });
	const callback = new URL(MOBILE_CALLBACK);
	callback.searchParams.set('code', code);
	callback.searchParams.set('state', flow.state);
	// The callback is a fixed application scheme, never a user-supplied redirect.
	redirect(303, callback.toString(), { external: true });
};
