import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { buildApiCatalog } from '$lib/server/agent-discovery/api-catalog';

export const prerender = false;

export const GET: RequestHandler = ({ url }) => {
	return json(buildApiCatalog(url), {
		headers: {
			'Content-Type': 'application/linkset+json',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
