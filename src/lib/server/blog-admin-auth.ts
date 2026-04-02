import { env } from '$env/dynamic/private';

function getAuthorizationBearer(request: Request): string | null {
	const authHeader = request.headers.get('authorization');
	if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
	return authHeader.slice(7).trim();
}

export function requireBlogAdminKey(request: Request): void {
	const configuredKeys = [
		env.BLOG_ADMIN_KEY,
		env.BLOG_ADMIN_KEY_2,
		env.BLOG_ADMIN_KEYS,
		env.VITE_BLOG_ADMIN_KEY,
		env.VITE_BLOG_ADMIN_KEY_2
	]
		.flatMap((value) => (value ? value.split(',') : []))
		.map((value) => value.trim())
		.filter((value) => value.length > 0);

	if (configuredKeys.length === 0) {
		throw new Response(JSON.stringify({ error: 'Invalid blog admin key' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const providedCandidates = [
		request.headers.get('x-blog-admin-key')?.trim() ?? '',
		request.headers.get('x-admin-key')?.trim() ?? '',
		request.headers.get('x-api-key')?.trim() ?? '',
		getAuthorizationBearer(request) ?? ''
	].filter((value) => value.length > 0);

	const isAuthorized = providedCandidates.some((candidate) => configuredKeys.includes(candidate));
	if (!isAuthorized) {
		throw new Response(JSON.stringify({ error: 'Invalid blog admin key' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}
