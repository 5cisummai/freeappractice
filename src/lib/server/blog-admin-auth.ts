import { env } from '$env/dynamic/private';

function getAuthorizationBearer(request: Request): string | null {
	const authHeader = request.headers.get('authorization');
	if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
	return authHeader.slice(7).trim();
}

export function requireBlogAdminKey(request: Request): void {
	const configuredKeys = [env.BLOG_ADMIN_KEY, env.BLOG_ADMIN_KEY_2].filter(
		(value): value is string => Boolean(value && value.trim().length > 0)
	);

	if (configuredKeys.length === 0) {
		throw new Response(JSON.stringify({ error: 'Blog admin key is not configured' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const providedCandidates = [
		request.headers.get('x-blog-admin-key')?.trim() ?? '',
		request.headers.get('x-admin-key')?.trim() ?? '',
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
