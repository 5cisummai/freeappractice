import type { RequestHandler } from './$types';
import { POST as canonicalPost } from '../../../undo/+server';

export const POST: RequestHandler = async (event) => {
	const headers = new Headers(event.request.headers);
	headers.set('content-type', 'application/json');
	const request = new Request(event.request.url, {
		method: 'POST',
		headers,
		body: JSON.stringify({ auditId: event.params.id })
	});

	return canonicalPost({ ...event, request } as unknown as Parameters<typeof canonicalPost>[0]);
};
