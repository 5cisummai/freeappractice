import type { RequestHandler } from './$types';
import { getMobileCatalogSnapshot } from '#lib/catalog/mobile-catalog.js';

/**
 * Public read-only AP course/unit catalog for native clients.
 *
 * Cache behavior:
 * - `version` is a content hash of the catalog payload (also returned as ETag).
 * - Clients may send `If-None-Match` to receive 304 when unchanged.
 * - `Cache-Control` allows short shared caching; the server remains authoritative
 *   about supported courses/units and MCQ availability.
 */
export const GET: RequestHandler = async ({ request, setHeaders }) => {
	const catalog = getMobileCatalogSnapshot();
	const etag = `"${catalog.version}"`;
	const ifNoneMatch = request.headers.get('if-none-match');
	setHeaders({
		ETag: etag,
		'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400'
	});

	if (ifNoneMatch === etag) {
		return new Response(null, { status: 304 });
	}

	return Response.json(catalog);
};
