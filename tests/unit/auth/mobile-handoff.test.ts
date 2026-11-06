import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#lib/auth/server.js', async () => {
	const { betterAuth } = await import('better-auth');
	const { memoryAdapter } = await import('better-auth/adapters/memory');
	const { bearer } = await import('better-auth/plugins');
	return {
		auth: betterAuth({
			baseURL: 'https://example.com',
			secret: 'synthetic-test-secret-with-at-least-32-characters',
			database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
			plugins: [bearer()],
			emailAndPassword: { enabled: true }
		})
	};
});

import { auth } from '#lib/auth/server.js';
import { POST } from '../../../src/routes/api/mobile-auth/exchange/+server.js';
import { GET as start } from '../../../src/routes/api/mobile-auth/start/+server.js';
import { GET as finish } from '../../../src/routes/app/mobile-auth/+server.js';
import {
	mobileCode,
	mobileHash,
	readMobileFlow,
	signMobileFlow
} from '#lib/auth/mobile-handoff.server.js';

const verifier = 'a'.repeat(43);
const secret = 'synthetic-secret';
let sourceToken: string;

beforeEach(async () => {
	const session = await auth.api.signUpEmail({
		body: { email: `${mobileCode()}@example.com`, password: 'synthetic-password', name: 'Student' }
	});
	sourceToken = session.token!;
});

async function issue(challenge = mobileHash(verifier), expiresAt = new Date(Date.now() + 60_000)) {
	const code = mobileCode();
	const context = await auth.$context;
	await context.internalAdapter.createVerificationValue({
		identifier: `mobile-handoff:${mobileHash(code)}`,
		value: JSON.stringify({ challenge, sessionToken: sourceToken }),
		expiresAt
	});
	return code;
}
function exchange(code: string, value = verifier) {
	return POST({
		request: new Request('https://example.com/api/mobile-auth/exchange', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ code, verifier: value })
		})
	} as Parameters<typeof POST>[0]);
}

describe('mobile browser session handoff', () => {
	it('creates a separate session and rejects replay', async () => {
		const code = await issue();
		const response = await exchange(code);
		const result = await response.json();
		expect(result.session.token).not.toBe(sourceToken);
		expect(result.session.userId).toBe(result.user.id);
		expect(response.headers.get('Cache-Control')).toBe('no-store');
		await expect(exchange(code)).rejects.toMatchObject({ status: 400 });
	});
	it('requires the matching verifier', async () => {
		await expect(exchange(await issue(), 'b'.repeat(43))).rejects.toMatchObject({ status: 400 });
	});
	it('rejects expired codes', async () => {
		await expect(
			exchange(await issue(mobileHash(verifier), new Date(Date.now() - 1000)))
		).rejects.toMatchObject({ status: 400 });
	});
	it('allows only one concurrent exchange', async () => {
		const code = await issue();
		const results = await Promise.allSettled([exchange(code), exchange(code)]);
		expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
	});
	it('rejects a revoked source session', async () => {
		const code = await issue();
		const context = await auth.$context;
		await context.internalAdapter.deleteSession(sourceToken);
		await expect(exchange(code)).rejects.toMatchObject({ status: 401 });
	});
	it('signs, validates, and expires the browser flow cookie', () => {
		const flow = {
			challenge: mobileHash(verifier),
			state: mobileCode(),
			expiresAt: Date.now() + 10000
		};
		const signed = signMobileFlow(flow, secret);
		expect(readMobileFlow(signed, secret)).toEqual(flow);
		expect(readMobileFlow(signed + 'x', secret)).toBeNull();
		expect(readMobileFlow(signed, 'wrong-secret')).toBeNull();
		expect(readMobileFlow(signMobileFlow({ ...flow, expiresAt: 0 }, secret), secret)).toBeNull();
	});
});

it('redirects through web signup and returns only a PKCE-bound code', async () => {
	let signedFlow = '';
	const state = mobileCode();
	const url = new URL('https://example.com/api/mobile-auth/start');
	url.searchParams.set('challenge', mobileHash(verifier));
	url.searchParams.set('state', state);
	url.searchParams.set('mode', 'signup');
	const cookies = {
		set: (_name: string, value: string) => {
			signedFlow = value;
		},
		get: () => signedFlow,
		delete: vi.fn()
	};
	await expect(
		start({ url, cookies, locals: {}, setHeaders: vi.fn() } as unknown as Parameters<
			typeof start
		>[0])
	).rejects.toMatchObject({ status: 303, location: '/signup?redirect=%2Fapp%2Fmobile-auth' });
	let location = '';
	try {
		await finish({
			cookies,
			request: new Request('https://example.com/app/mobile-auth', {
				headers: { Authorization: `Bearer ${sourceToken}` }
			}),
			setHeaders: vi.fn()
		} as unknown as Parameters<typeof finish>[0]);
	} catch (result) {
		if (!(result as { location?: string }).location) throw result;
		location = (result as { location: string }).location;
	}
	const callback = new URL(location);
	expect(callback.protocol).toBe('org.freeappractice.ios:');
	expect(callback.searchParams.get('state')).toBe(state);
	expect(location).not.toContain(sourceToken);
	expect(cookies.delete).toHaveBeenCalled();
	const result = await exchange(callback.searchParams.get('code')!);
	expect(result.status).toBe(200);
});
