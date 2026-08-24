import * as Sentry from '@sentry/sveltekit';
import type { Handle, HandleServerError } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { auth } from '$lib/auth/server';
import { logger } from '$lib/server/logger';
import { getAllowedOrigins } from '$lib/auth/trusted-origins.server';
import { capturePostHogServerEvent } from '$lib/server/posthog';
import { createPostHogProxyRequestInit } from '$lib/server/posthog-proxy';
import { buildHomepageLinkHeader } from '$lib/server/agent-discovery/link-headers';
import {
	acceptsMarkdown,
	getHomepageMarkdown,
	htmlToBasicMarkdown,
	markdownResponse
} from '$lib/server/agent-discovery/markdown';
import { env } from '$env/dynamic/private';
import { building } from '$app/environment';
import { createHandle } from 'flags/sveltekit';
import {
	examfigDiagramsEnabled,
	frqPracticeEnabled,
	isSuperFreeBetaEnabled,
	superCheckoutEnabled,
	superCoachEnabled,
	superMemoryEnabled,
	superFreeBetaEnabled
} from '$lib/flags';
import { isSuperStripeConfigured } from '$lib/super/billing.server';
import {
	isAccountSurface,
	isAgeGateExempt
} from '$lib/auth/account-surface.server';
import { getTutorProfileViewForRequest } from '$lib/super/feature-access.server';
import { limitApiRequests } from '$lib/server/api-rate-limit.server';
import {
	shouldSkipGlobalApiRateLimit,
	shouldSkipSessionLookup
} from '$lib/server/request-policy.server';

// ── Security headers ────────────────────────────────────────
const SECURITY_HEADERS: Record<string, string> = {
	'X-Frame-Options': 'DENY',
	'X-Content-Type-Options': 'nosniff',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), identity-credentials-get=(self)',
	'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload'
};

const CORS_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
const CORS_HEADERS = 'Content-Type, Authorization';
const ALLOWED_ORIGINS = getAllowedOrigins();

function applyCorsHeaders(response: Response, origin: string | null): Response {
	if (!origin || !ALLOWED_ORIGINS.has(origin)) {
		return response;
	}
	response.headers.set('Access-Control-Allow-Origin', origin);
	response.headers.set('Access-Control-Allow-Credentials', 'true');
	response.headers.set('Access-Control-Allow-Methods', CORS_METHODS);
	response.headers.set('Access-Control-Allow-Headers', CORS_HEADERS);
	const vary = response.headers.get('Vary');
	response.headers.set('Vary', vary ? `${vary}, Origin` : 'Origin');

	return response;
}

function postProcessResponse(
	response: Response,
	event: Parameters<Handle>[0]['event'],
	origin: string | null
): Response {
	for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
		response.headers.set(key, value);
	}

	if (event.url.pathname === '/' || event.url.pathname === '') {
		response.headers.set('Link', buildHomepageLinkHeader());

		// The homepage is public and identical for authenticated and anonymous users;
		// authentication only redirects client-side. Cache it at Vercel's CDN while
		// keeping the HTML/Markdown content-negotiation variants separate.
		if (event.request.method === 'GET' && response.status === 200) {
			response.headers.set('Cache-Control', 'public, max-age=0');
			response.headers.set(
				'Vercel-CDN-Cache-Control',
				'public, s-maxage=60, stale-while-revalidate=60'
			);
			const vary = response.headers.get('Vary');
			if (!vary?.split(',').some((value) => value.trim().toLowerCase() === 'accept')) {
				response.headers.set('Vary', vary ? `${vary}, Accept` : 'Accept');
			}
		}
	}

	if (event.url.pathname.startsWith('/api/')) {
		response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
		response.headers.set('Pragma', 'no-cache');
	}

	return applyCorsHeaders(response, origin);
}

async function maybeServeMarkdown(
	response: Response,
	event: Parameters<Handle>[0]['event']
): Promise<Response> {
	if (event.request.method !== 'GET') return response;
	if (!acceptsMarkdown(event.request)) return response;

	const contentType = response.headers.get('content-type') ?? '';
	if (!contentType.includes('text/html')) return response;

	const { pathname } = event.url;

	const html = await response.text();
	const fallbackTitle = pathname.split('/').filter(Boolean).at(-1) ?? 'Free AP Practice';
	return markdownResponse(htmlToBasicMarkdown(html, fallbackTitle));
}

const posthogProxyHandle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;

	if (pathname.startsWith('/ingest')) {
		const useAssetHost =
			pathname.startsWith('/ingest/static/') || pathname.startsWith('/ingest/array/');
		const hostname = useAssetHost ? 'us-assets.i.posthog.com' : 'us.i.posthog.com';

		const url = new URL(event.request.url);
		url.protocol = 'https:';
		url.hostname = hostname;
		url.port = '443';
		url.pathname = pathname.replace(/^\/ingest/, '');

		const clientIp = event.getClientAddress();
		const response = await fetch(
			url.toString(),
			createPostHogProxyRequestInit(event.request, clientIp)
		);

		return response;
	}

	return resolve(event);
};

const appHandle: Handle = async ({ event, resolve }) => {
	const origin = event.request.headers.get('origin');
	const isAllowedOrigin = origin !== null && ALLOWED_ORIGINS.has(origin);

	if (
		event.request.method === 'GET' &&
		acceptsMarkdown(event.request) &&
		(event.url.pathname === '/' || event.url.pathname === '')
	) {
		return postProcessResponse(markdownResponse(await getHomepageMarkdown()), event, origin);
	}

	if (event.url.pathname === '/favicon.ico') {
		return new Response(null, {
			status: 308,
			headers: {
				Location: '/favicon.png'
			}
		});
	}

	if (event.request.method === 'OPTIONS') {
		if (!isAllowedOrigin) {
			return new Response(null, { status: 403 });
		}

		return applyCorsHeaders(
			new Response(null, {
				status: 204,
				headers: {
					'Access-Control-Max-Age': '86400'
				}
			}),
			origin
		);
	}

	event.locals.userId = undefined;
	event.locals.user = undefined;
	event.locals.session = undefined;
	event.locals.planAccess = undefined;
	event.locals.tutorProfileView = undefined;
	event.locals.assistantFeaturesEnabled = undefined;

	// Public MCQ serve path: skip Better Auth session I/O to keep pool-hit latency low.
	// Logging, CORS, and security headers still run. FRQ and /api/me/* keep full auth.
	const skipSessionLookup = shouldSkipSessionLookup(event.request.method, event.url.pathname);

	if (!skipSessionLookup) {
		try {
			const session = await auth.api.getSession({ headers: event.request.headers });
			if (session) {
				event.locals.session = session.session;
				event.locals.user = session.user;
				event.locals.userId = session.user.id;
			}
		} catch (err) {
			logger.error('Session lookup failed', { error: err, path: event.url.pathname });
		}
	}

	if (
		event.url.pathname.startsWith('/api/') &&
		!shouldSkipGlobalApiRateLimit(event.request.method, event.url.pathname)
	) {
		const rateLimit = await limitApiRequests(event.request, event.locals.userId);
		if (!rateLimit.allowed) {
			const now = Date.now();
			const retryAfterSeconds = Math.max(
				1,
				Math.ceil(Math.max(0, (rateLimit.retryAt ?? now) - now) / 1000)
			);
			return postProcessResponse(
				new Response(JSON.stringify({ error: 'Too many requests', retryAfterSeconds }), {
					status: 429,
					headers: {
						'Content-Type': 'application/json',
						'RateLimit-Limit': String(rateLimit.limit),
						'RateLimit-Remaining': '0',
						'RateLimit-Reset': String(retryAfterSeconds),
						'Retry-After': String(retryAfterSeconds)
					}
				}),
				event,
				origin
			);
		}
	}

	if (event.request.method === 'POST' && event.url.pathname === '/api/auth/subscription/upgrade') {
		if (await isSuperFreeBetaEnabled()) {
			return new Response(
				JSON.stringify({
					error: 'Super checkout is paused while the free beta offer is available.'
				}),
				{
					status: 410,
					headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
				}
			);
		}
		if (!(await isSuperCheckoutEnabled())) {
			return new Response(
				JSON.stringify({ error: 'New Super checkout is temporarily unavailable.' }),
				{
					status: 503,
					headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
				}
			);
		}
		if (!isSuperStripeConfigured()) {
			return new Response(JSON.stringify({ error: 'Super checkout is not configured.' }), {
				status: 503,
				headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
			});
		}
		if (!event.locals.userId) {
			return new Response(JSON.stringify({ error: 'Authentication required' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
			});
		}
		if (!(await getTutorProfileViewForRequest(event.locals, event.locals.userId)).ageConfirmedAt) {
			return new Response(
				JSON.stringify({ error: 'Confirm that you are at least 13 before choosing Super.' }),
				{
					status: 403,
					headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
				}
			);
		}
	}

	const ageGateExempt = isAgeGateExempt(event.url.pathname);
	if (event.locals.userId && isAccountSurface(event.url.pathname) && !ageGateExempt) {
		const profile = await getTutorProfileViewForRequest(event.locals, event.locals.userId);
		if (!profile.ageConfirmedAt) {
			if (event.url.pathname.startsWith('/api/')) {
				return new Response(
					JSON.stringify({ error: 'Confirm that you are at least 13 before using your account.' }),
					{
						status: 403,
						headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
					}
				);
			}
			if (event.url.pathname.startsWith('/app')) {
				return new Response(null, {
					status: 303,
					headers: { Location: '/app/onboarding', 'Cache-Control': 'no-store' }
				});
			}
		}
	}

	const requestStart = Date.now();

	const resolved = await resolve(event);
	const response = postProcessResponse(await maybeServeMarkdown(resolved, event), event, origin);

	const requestTimeMs = Date.now() - requestStart;
	const requestMeta = {
		method: event.request.method,
		url: event.url.pathname,
		status: response.status,
		requestTimeMs
	};
	if (response.status >= 500) {
		logger.error('http request failed', requestMeta);
	} else {
		logger.info('http request', requestMeta);
	}

	return response;
};

export const handle = sequence(
	Sentry.sentryHandle(),
	...(env.FLAGS_SECRET && !building
		? [
				createHandle({
					secret: env.FLAGS_SECRET,
					flags: {
						frqPracticeEnabled,
						examfigDiagramsEnabled,
						superFreeBetaEnabled,
						superCheckoutEnabled,
						superCoachEnabled,
						superMemoryEnabled
					}
				}) as Handle
			]
		: []),
	posthogProxyHandle,
	appHandle
);

export const handleError: HandleServerError = Sentry.handleErrorWithSentry(
	async ({ error, event, status, message }) => {
		logger.error('Unhandled server error', {
			error,
			status,
			message,
			method: event.request.method,
			path: event.url.pathname
		});

		capturePostHogServerEvent(event.request, {
			distinctId: 'server',
			event: 'server_error',
			properties: {
				error_type: error instanceof Error ? error.name : 'UnknownError',
				status,
				path: event.url.pathname
			}
		});

		return {
			message,
			status
		};
	}
);
