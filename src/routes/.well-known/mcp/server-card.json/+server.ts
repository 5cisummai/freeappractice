import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { buildMcpServerCard } from '$lib/server/agent-discovery/mcp';

export const prerender = false;

export const GET: RequestHandler = ({ url }) => {
	return json(buildMcpServerCard(url), {
		headers: {
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
