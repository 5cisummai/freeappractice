import type { Handle, HandleServerError } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { auth } from '$lib/auth/server';
import { logger } from '$lib/server/logger';
import { getAllowedOrigins } from '$lib/auth/trusted-origins.server';
import { capturePostHogServerEvent } from '$lib/server/posthog';
import { createPostHogProxyRequestInit } from '$lib/server/posthog-proxy';
import { enforceConfiguredAiRateLimit } from '$lib/server/api-rate-limit.server';

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

	if (event.url.pathname.startsWith('/desmos-sandbox')) {
		const csp = response.headers.get('Content-Security-Policy');
		if (csp) {
			const patched = csp
				.replace(/(script-src\s)/, "$1'unsafe-eval' ")
				.replace(/frame-ancestors\s+'none'/, "frame-ancestors 'self'");
			response.headers.set('Content-Security-Policy', patched);
		}
		response.headers.set('X-Frame-Options', 'SAMEORIGIN');
	}

	if (event.url.pathname.startsWith('/api/')) {
		response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
		response.headers.set('Pragma', 'no-cache');
	}

	return applyCorsHeaders(response, origin);
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

	const rateLimitResponse = await enforceConfiguredAiRateLimit(event);
	if (rateLimitResponse) {
		return postProcessResponse(rateLimitResponse, event, origin);
	}

	const requestStart = Date.now();

	const response = postProcessResponse(await resolve(event), event, origin);

	const requestTimeMs = Date.now() - requestStart;
	logger.info('http request', {
		method: event.request.method,
		url: event.url.pathname,
		status: response.status,
		requestTimeMs,
		ip:
			event.request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
			event.request.headers.get('x-real-ip') ??
			'unknown'
	});

	return response;
};

export const handle = sequence(posthogProxyHandle, appHandle);

export const handleError: HandleServerError = async ({ error, event, status, message }) => {
	capturePostHogServerEvent(event.request, {
		distinctId: 'server',
		event: 'server_error',
		properties: {
			error: error instanceof Error ? error.message : String(error),
			status,
			message
		}
	});

	return {
		message,
		status
	};
};
