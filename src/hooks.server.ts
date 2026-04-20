import type { Handle } from '@sveltejs/kit';
import { verifyToken, extractToken } from '$lib/server/auth';
import { connectDb } from '$lib/server/db';
import { User } from '$lib/server/models/user';
import { env } from '$env/dynamic/private';
import { logger } from '$lib/server/logger';

// ── In-memory rate limiter ──────────────────────────────────
// TODO: For multi-instance (Vercel/Cloudflare) production deploys,
// replace with a Redis-backed solution like @upstash/ratelimit.
const WINDOW_MS = parseInt(env.API_RATE_LIMIT_WINDOW_MS ?? '900000', 10); // 15 min
const MAX_REQUESTS = parseInt(env.API_RATE_LIMIT_MAX ?? '500', 10);

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
	const now = Date.now();
	const entry = rateLimitMap.get(ip);

	if (!entry || now > entry.resetAt) {
		rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
		return true;
	}
	if (entry.count >= MAX_REQUESTS) return false;
	entry.count++;
	return true;
}

// Clean up stale entries periodically to prevent memory leaks
setInterval(() => {
	const now = Date.now();
	for (const [key, val] of rateLimitMap) {
		if (now > val.resetAt) rateLimitMap.delete(key);
	}
}, WINDOW_MS);

// ── Security headers ────────────────────────────────────────
// CSP is managed by SvelteKit's built-in csp config in svelte.config.js,
// which automatically injects nonces for SSR and hashes for prerendered pages.
const SECURITY_HEADERS: Record<string, string> = {
	'X-Frame-Options': 'DENY',
	'X-Content-Type-Options': 'nosniff',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
	'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload'
};

const DEFAULT_ALLOWED_ORIGINS = [
	'https://freeappractice.org',
	'https://www.freeappractice.org',
	'http://127.0.0.1:3000',
	'http://127.0.0.1:4173',
	'http://127.0.0.1:5173',
	'http://localhost:5173',
	'http://localhost:4173',
	'http://localhost:3000'
];

const CORS_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
const CORS_HEADERS = 'Content-Type, Authorization, X-Questions-Admin-Secret';

function toOrigin(value: string | undefined): string | null {
	if (!value) return null;

	try {
		const normalized = value.includes('://') ? value : `https://${value}`;
		return new URL(normalized).origin;
	} catch {
		return null;
	}
}

function getAllowedOrigins(): Set<string> {
	const origins = new Set(DEFAULT_ALLOWED_ORIGINS);
	const configuredOrigins = [
		env.PUBLIC_BASE_URL,
		env.APP_BASE_URL,
		env.WEBSITE_URL,
		env.VERCEL_URL,
		env.VERCEL_BRANCH_URL,
		env.VERCEL_PROJECT_PRODUCTION_URL
	];

	for (const value of configuredOrigins) {
		const origin = toOrigin(value);
		if (origin) origins.add(origin);
	}

	return origins;
}

const ALLOWED_ORIGINS = getAllowedOrigins();

function applyCorsHeaders(response: Response, origin: string | null): Response {
	if (!origin || !ALLOWED_ORIGINS.has(origin)) {
		return response;
	}

	response.headers.set('Access-Control-Allow-Origin', origin);
	response.headers.set('Access-Control-Allow-Credentials', 'true');
	response.headers.set('Access-Control-Allow-Methods', CORS_METHODS);
	response.headers.set('Access-Control-Allow-Headers', CORS_HEADERS);
	response.headers.set('Vary', 'Origin');

	return response;
}

export const handle: Handle = async ({ event, resolve }) => {
	// ── CORS ──────────────────────────────────────────────────
	const origin = event.request.headers.get('origin');
	const isAllowedOrigin = origin !== null && ALLOWED_ORIGINS.has(origin);

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

	// ── Rate limiting for /api/* ──────────────────────────────
	if (event.url.pathname.startsWith('/api/')) {
		const ip =
			event.request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
			event.request.headers.get('x-real-ip') ??
			'unknown';

		if (!checkRateLimit(ip)) {
			return applyCorsHeaders(
				new Response(JSON.stringify({ error: 'Too many requests' }), {
					status: 429,
					headers: {
						'Content-Type': 'application/json',
						'Retry-After': String(Math.ceil(WINDOW_MS / 1000))
					}
				}),
				origin
			);
		}
	}

	// ── JWT extraction → populate locals ─────────────────────
	event.locals.userId = null;
	const token = extractToken(event.request);
	if (token) {
		try {
			const decoded = verifyToken(token);
			await connectDb();
			const user = await User.findById(decoded.userId).select('verified');
			if (user?.verified) {
				event.locals.userId = decoded.userId;
			}
		} catch {
			// Invalid token - locals.userId stays null
		}
	}

	const requestStart = Date.now();
	const response = await resolve(event);

	// ── Apply security headers ────────────────────────────────
	for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
		response.headers.set(key, value);
	}

	// ── Desmos sandbox: extend CSP with 'unsafe-eval' ─────────
	// Desmos requires eval() to render its calculator. We confine that permission to
	// the /desmos-sandbox route (served in an iframe) so the main app stays safe.
	if (event.url.pathname.startsWith('/desmos-sandbox')) {
		const csp = response.headers.get('Content-Security-Policy');
		if (csp) {
			// Add 'unsafe-eval' to script-src and allow same-origin framing for the iframe
			const patched = csp
				.replace(/(script-src\s)/, "$1'unsafe-eval' ")
				.replace(/frame-ancestors\s+'none'/, "frame-ancestors 'self'");
			response.headers.set('Content-Security-Policy', patched);
		}
		// Override X-Frame-Options so the page can be embedded in same-origin iframes
		response.headers.set('X-Frame-Options', 'SAMEORIGIN');
	}

	// ── Cache-Control for API routes (prevent sensitive data caching) ──
	if (event.url.pathname.startsWith('/api/')) {
		response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
		response.headers.set('Pragma', 'no-cache');
	}

	applyCorsHeaders(response, origin);

	// ── Request logging ──────────────────────────────────────
	const requestTimeMs = Date.now() - requestStart;
	logger.info('http request', {
		method: event.request.method,
		url: event.url.pathname + event.url.search,
		status: response.status,
		requestTimeMs,
		ip:
			event.request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
			event.request.headers.get('x-real-ip') ??
			'unknown'
	});

	return response;
};
