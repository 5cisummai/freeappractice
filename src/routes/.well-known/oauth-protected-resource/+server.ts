import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { buildOAuthProtectedResourceMetadata } from '$lib/server/agent-discovery/oauth';

export const prerender = false;

export const GET: RequestHandler = ({ url }) => {
	return json(buildOAuthProtectedResourceMetadata(url), {
		headers: {
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
