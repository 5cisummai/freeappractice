import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '$env/static/private';
import { User } from '$lib/server/models/user';
import { connectDb } from '$lib/server/db';
import type { RequestEvent } from '@sveltejs/kit';

const JWT_EXPIRY = '14d';
const PENDING_SIGNUP_TOKEN_EXPIRY = '30m';

export function signToken(userId: string): string {
	return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export function signPendingSignupToken(userId: string, email: string): string {
	return jwt.sign({ userId, email, purpose: 'pending_signup' }, JWT_SECRET, {
		expiresIn: PENDING_SIGNUP_TOKEN_EXPIRY
	});
}

export function verifyToken(token: string): { userId: string } {
	return jwt.verify(token, JWT_SECRET) as { userId: string };
}

export function extractToken(request: Request): string | null {
	const authHeader = request.headers.get('authorization');
	if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
	return authHeader.slice(7);
}

/**
 * Full auth guard for use in +server.ts handlers.
 * Populates event.locals.userId and returns the userId string.
 * Throws a Response (401/403) if auth fails.
 */
export async function requireAuth(event: RequestEvent): Promise<string> {
	const token = extractToken(event.request);
	if (!token) {
		throw new Response(JSON.stringify({ error: 'No token provided' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	let decoded: { userId: string };
	try {
		decoded = verifyToken(token);
	} catch {
		throw new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	await connectDb();
	const user = await User.findById(decoded.userId).select('verified');
	if (!user) {
		throw new Response(JSON.stringify({ error: 'User not found' }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' }
		});
	}
	if (!user.verified) {
		throw new Response(JSON.stringify({ error: 'Email not verified' }), {
			status: 403,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	event.locals.userId = decoded.userId;
	return decoded.userId;
}
