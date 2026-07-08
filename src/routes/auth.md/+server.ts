import type { RequestHandler } from './$types';
import { buildAuthMd } from '$lib/server/agent-discovery/auth-md';
import { markdownResponse } from '$lib/server/agent-discovery/markdown';

export const prerender = false;

export const GET: RequestHandler = ({ url }) => {
	return markdownResponse(buildAuthMd(url), {
		headers: {
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
