import type { RequestHandler } from './$types';
import { listApArtHistoryContentAreas } from '#lib/ap-art-history/repository.server.js';
import {
	jsonWithApArtHistoryCache,
	serveApArtHistoryGet
} from '#lib/ap-art-history/request.server.js';
import { logger } from '#lib/server/logger.js';

export const GET: RequestHandler = async (event) => {
	return serveApArtHistoryGet(event, { path: '/api/ap-art-history/content-areas' }, async () => {
		try {
			const items = await listApArtHistoryContentAreas();
			return jsonWithApArtHistoryCache({ items });
		} catch (error) {
			logger.error('AP Art History content-areas error', { error });
			return Response.json({ error: 'Failed to load content areas' }, { status: 500 });
		}
	});
};
