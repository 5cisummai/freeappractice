import { describe, expect, it } from 'vitest';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { bearer } from 'better-auth/plugins';

describe('native bearer session compatibility', () => {
	it('resolves a native token and preserves browser cookie sessions', async () => {
		const auth = betterAuth({
			baseURL: 'https://example.com',
			secret: 'synthetic-test-secret-with-at-least-32-characters',
			database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
			emailAndPassword: { enabled: true },
			plugins: [bearer()]
		});
		const signup = await auth.handler(
			new Request('https://example.com/api/auth/sign-up/email', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Origin: 'https://example.com' },
				body: JSON.stringify({
					email: 'student@example.com',
					password: 'synthetic-password',
					name: 'Student'
				})
			})
		);
		expect(signup.status).toBe(200);
		const result = await signup.json();
		const nativeSession = await auth.api.getSession({
			headers: new Headers({ Authorization: `Bearer ${result.token}` })
		});
		expect(nativeSession?.user.email).toBe('student@example.com');
		const signedToken = signup.headers.get('set-auth-token');
		expect(signedToken).toBeTruthy();
		const browserSession = await auth.api.getSession({
			headers: new Headers({ Cookie: `__Secure-better-auth.session_token=${signedToken}` })
		});
		expect(browserSession?.user.id).toBe(nativeSession?.user.id);
		const invalid = await auth.api.getSession({
			headers: new Headers({ Authorization: 'Bearer invalid-token' })
		});
		expect(invalid).toBeNull();
	});
});
