import { timingSafeEqual } from 'node:crypto';

export function isAuthorizedCronRequest(request: Request, cronSecret: string | undefined): boolean {
	if (!cronSecret) return false;
	const header = request.headers.get('authorization');
	if (!header?.startsWith('Bearer ')) return false;

	const token = header.slice('Bearer '.length);
	const expected = Buffer.from(cronSecret);
	const actual = Buffer.from(token);
	if (expected.length !== actual.length) return false;
	return timingSafeEqual(expected, actual);
}
