import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { auth } from '#lib/auth/server.js';
import { isMobileOpaque, MOBILE_COOKIE, signMobileFlow } from '#lib/auth/mobile-handoff.server.js';

export const GET: RequestHandler = async ({ url, cookies, locals, setHeaders }) => {
	const challenge = url.searchParams.get('challenge');
	const state = url.searchParams.get('state');
	if (!isMobileOpaque(challenge) || !isMobileOpaque(state))
		error(400, 'Invalid mobile sign-in request');
	const context = await auth.$context;
	cookies.set(
		MOBILE_COOKIE,
		signMobileFlow({ challenge, state, expiresAt: Date.now() + 30 * 60_000 }, context.secret),
		{
			path: '/',
			httpOnly: true,
			secure: new URL(context.baseURL).protocol === 'https:',
			sameSite: 'lax',
			maxAge: 1800
		}
	);
	setHeaders({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
	if (locals.userId) redirect(303, '/app/mobile-auth');
	const destination = url.searchParams.get('mode') === 'signup' ? '/signup' : '/login';
	redirect(303, `${destination}?redirect=${encodeURIComponent('/app/mobile-auth')}`);
};
