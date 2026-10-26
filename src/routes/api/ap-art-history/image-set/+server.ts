import type { RequestHandler } from './$types';
import { listApArtHistoryWorks } from '#lib/ap-art-history/repository.server.js';
import {
	jsonWithApArtHistoryCache,
	parseOptionalInt,
	parsePositiveInt,
	serveApArtHistoryGet
} from '#lib/ap-art-history/request.server.js';
import { logger } from '#lib/server/logger.js';

export const GET: RequestHandler = async (event) => {
	return serveApArtHistoryGet(event, { path: '/api/ap-art-history/image-set' }, async () => {
		try {
			const limit = Math.min(parsePositiveInt(event.url.searchParams.get('limit'), 50), 250);
			const page = parsePositiveInt(event.url.searchParams.get('page'), 1);
			const contentArea = event.url.searchParams.get('content_area')?.trim() || undefined;
			const locationStatus = event.url.searchParams.get('location_status')?.trim() || undefined;
			const numberFrom = parseOptionalInt(event.url.searchParams.get('number_from'));
			const numberTo = parseOptionalInt(event.url.searchParams.get('number_to'));

			const result = await listApArtHistoryWorks({
				page,
				limit,
				contentArea,
				locationStatus,
				numberFrom,
				numberTo
			});
			return jsonWithApArtHistoryCache(result);
		} catch (error) {
			logger.error('AP Art History image-set list error', { error });
			return Response.json({ error: 'Failed to load image set' }, { status: 500 });
		}
	});
};
