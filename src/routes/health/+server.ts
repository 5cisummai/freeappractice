import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async () => {
	return json({ status: 'ok', timestamp: new Date().toISOString() });
};
