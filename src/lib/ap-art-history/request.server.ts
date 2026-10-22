import type { RequestEvent } from '@sveltejs/kit';
import { recordApArtHistoryApiRequestBestEffort } from '#lib/ap-art-history/history.server.js';

export const AP_ART_HISTORY_CACHE_CONTROL =
	'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400';

export function jsonWithApArtHistoryCache(
	body: unknown,
	init?: { status?: number }
): Response {
	return Response.json(body, {
		status: init?.status ?? 200,
		headers: { 'Cache-Control': AP_ART_HISTORY_CACHE_CONTROL }
	});
}

type ApArtHistoryHandlerOptions = {
	path: string;
	workNumber?: number;
};

export async function serveApArtHistoryGet(
	event: RequestEvent,
	options: ApArtHistoryHandlerOptions,
	handler: () => Promise<Response>
): Promise<Response> {
	const startedAt = Date.now();
	const response = await handler();
	recordApArtHistoryApiRequestBestEffort({
		method: event.request.method,
		path: options.path,
		query: event.url.search || null,
		workNumber: options.workNumber,
		userId: event.locals.userId ?? null,
		statusCode: response.status,
		durationMs: Date.now() - startedAt
	});
	return response;
}

export function parsePositiveInt(value: string | null, fallback: number): number {
	if (!value) return fallback;
	const parsed = parseInt(value, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseOptionalInt(value: string | null): number | undefined {
	if (!value?.trim()) return undefined;
	const parsed = parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : undefined;
}
