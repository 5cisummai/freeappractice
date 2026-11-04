import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const MOBILE_CALLBACK = 'org.freeappractice.ios://auth/callback';
export const MOBILE_COOKIE = 'mobile-auth-flow';
const opaque = /^[A-Za-z0-9_-]{43}$/;
export const isMobileOpaque = (value: unknown): value is string =>
	typeof value === 'string' && opaque.test(value);
export const mobileHash = (value: string): string =>
	createHash('sha256').update(value).digest('base64url');
export const mobileCode = (): string => randomBytes(32).toString('base64url');
export type MobileFlow = { challenge: string; state: string; expiresAt: number };

export function signMobileFlow(flow: MobileFlow, secret: string): string {
	const payload = Buffer.from(JSON.stringify(flow)).toString('base64url');
	return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
}

export function readMobileFlow(value: string | undefined, secret: string): MobileFlow | null {
	if (!value || value.length > 1024) return null;
	const [payload, signature, extra] = value.split('.');
	if (!payload || !signature || extra) return null;
	const expected = createHmac('sha256', secret).update(payload).digest();
	const supplied = Buffer.from(signature, 'base64url');
	if (supplied.length !== expected.length || !timingSafeEqual(expected, supplied)) return null;
	try {
		const flow = JSON.parse(Buffer.from(payload, 'base64url').toString());
		if (
			!isMobileOpaque(flow.challenge) ||
			!isMobileOpaque(flow.state) ||
			!Number.isFinite(flow.expiresAt) ||
			flow.expiresAt <= Date.now()
		)
			return null;
		return flow;
	} catch {
		return null;
	}
}
