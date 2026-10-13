import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = () => {
	return Response.json({ status: 'ok', timestamp: new Date().toISOString() });
};
