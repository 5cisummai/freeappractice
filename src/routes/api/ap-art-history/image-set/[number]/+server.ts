import type { RequestHandler } from './$types';
import { getApArtHistoryWorkByNumber } from '#lib/ap-art-history/repository.server.js';
import {
	jsonWithApArtHistoryCache,
	serveApArtHistoryGet
} from '#lib/ap-art-history/request.server.js';
import { logger } from '#lib/server/logger.js';

export const GET: RequestHandler = async (event) => {
	const raw = event.params.number;
	const workNumber = parseInt(raw, 10);
	if (!Number.isFinite(workNumber) || workNumber < 1 || workNumber > 250) {
		return Response.json({ error: 'Invalid work number' }, { status: 400 });
	}

	return serveApArtHistoryGet(
		event,
		{ path: `/api/ap-art-history/image-set/${raw}`, workNumber },
		async () => {
			try {
				const work = await getApArtHistoryWorkByNumber(workNumber);
				if (!work) {
					return Response.json({ error: 'Work not found' }, { status: 404 });
				}
				return jsonWithApArtHistoryCache(work);
			} catch (error) {
				logger.error('AP Art History image-set get error', { error, workNumber });
				return Response.json({ error: 'Failed to load work' }, { status: 500 });
			}
		}
	);
};
