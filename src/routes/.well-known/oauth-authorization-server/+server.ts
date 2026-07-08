import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { buildOAuthAuthorizationServerMetadata } from '$lib/server/agent-discovery/oauth';

export const prerender = false;

export const GET: RequestHandler = ({ url }) => {
	return json(buildOAuthAuthorizationServerMetadata(url), {
		headers: {
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
