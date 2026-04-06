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
const SECURITY_HEADERS: Record<string, string> = {
	'X-Frame-Options': 'DENY',
	'X-Content-Type-Options': 'nosniff',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
	'Content-Security-Policy': [
		"default-src 'self'",
		"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com/gsi/client https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://va.vercel-scripts.com https://www.desmos.com",
		"style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/client https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://fonts.googleapis.com",
		"font-src 'self' https://fonts.gstatic.com data:",
		"img-src 'self' data: https:",
		"connect-src 'self' https://accounts.google.com/gsi/ https://va.vercel-scripts.com https://www.desmos.com",
		'frame-src https://accounts.google.com/gsi/ https://www.desmos.com'
	].join('; ')
};

const ALLOWED_ORIGINS = [
	'https://freeappractice.org',
	'http://localhost:5173',
	'http://localhost:3000'
];

const CORS_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
const CORS_HEADERS = 'Content-Type, Authorization';

export const handle: Handle = async ({ event, resolve }) => {
	// ── CORS ──────────────────────────────────────────────────
	const origin = event.request.headers.get('origin');
	const isAllowedOrigin = origin && ALLOWED_ORIGINS.includes(origin);

	if (event.request.method === 'OPTIONS') {
		if (!isAllowedOrigin) {
			return new Response(null, { status: 403 });
		}

		return new Response(null, {
			headers: {
				'Access-Control-Allow-Origin': origin,
				'Access-Control-Allow-Methods': CORS_METHODS,
				'Access-Control-Allow-Headers': CORS_HEADERS,
				'Access-Control-Allow-Credentials': 'true',
				'Access-Control-Max-Age': '86400',
				Vary: 'Origin'
			}
		});
	}

	// ── Rate limiting for /api/* ──────────────────────────────
	if (event.url.pathname.startsWith('/api/')) {
		const ip =
			event.request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
			event.request.headers.get('x-real-ip') ??
			'unknown';

		if (!checkRateLimit(ip)) {
			return new Response(JSON.stringify({ error: 'Too many requests' }), {
				status: 429,
				headers: {
					'Content-Type': 'application/json',
					'Retry-After': String(Math.ceil(WINDOW_MS / 1000))
				}
			});
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

	if (isAllowedOrigin) {
		response.headers.set('Access-Control-Allow-Origin', origin);
		response.headers.set('Access-Control-Allow-Credentials', 'true');
		response.headers.set('Access-Control-Allow-Methods', CORS_METHODS);
		response.headers.set('Access-Control-Allow-Headers', CORS_HEADERS);
		response.headers.set('Vary', 'Origin');
	}

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
