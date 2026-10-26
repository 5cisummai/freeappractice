import { apiFetch, getResponseMessage, readJsonOrNull } from '#lib/client/api.js';
import type {
	ApArtHistoryContentAreaSummary,
	ApArtHistoryWorkRow
} from '#lib/ap-art-history/types.js';

export type ApArtHistoryWorkListResponse = {
	items: ApArtHistoryWorkRow[];
	total: number;
	page: number;
	limit: number;
};

export type ApArtHistoryContentAreasResponse = {
	items: ApArtHistoryContentAreaSummary[];
};

export class ApArtHistoryRequestError extends Error {
	readonly status: number | null;

	constructor(message: string, status: number | null = null) {
		super(message);
		this.name = 'ApArtHistoryRequestError';
		this.status = status;
	}
}

async function parseJsonResponse<T>(response: Response, fallbackError: string): Promise<T> {
	const payload = await readJsonOrNull<T & { error?: string }>(response);
	if (!response.ok || !payload) {
		throw new ApArtHistoryRequestError(
			getResponseMessage(payload, fallbackError),
			response.ok ? null : response.status
		);
	}
	return payload;
}

export async function fetchApArtHistoryContentAreas(): Promise<ApArtHistoryContentAreaSummary[]> {
	const response = await apiFetch('/api/ap-art-history/content-areas');
	const payload = await parseJsonResponse<ApArtHistoryContentAreasResponse>(
		response,
		'Failed to load content areas.'
	);
	return payload.items;
}

export type FetchApArtHistoryWorksParams = {
	contentArea?: string;
	page?: number;
	limit?: number;
	numberFrom?: number;
	numberTo?: number;
};

export async function fetchApArtHistoryWorks(
	params: FetchApArtHistoryWorksParams = {}
): Promise<ApArtHistoryWorkListResponse> {
	const search = new URLSearchParams();
	const limit = params.limit ?? 250;
	const page = params.page ?? 1;
	search.set('limit', String(limit));
	search.set('page', String(page));
	if (params.contentArea?.trim()) search.set('content_area', params.contentArea.trim());
	if (params.numberFrom !== undefined) search.set('number_from', String(params.numberFrom));
	if (params.numberTo !== undefined) search.set('number_to', String(params.numberTo));

	const response = await apiFetch(`/api/ap-art-history/image-set?${search.toString()}`);
	return parseJsonResponse<ApArtHistoryWorkListResponse>(response, 'Failed to load works.');
}

export async function fetchApArtHistoryWorkByNumber(number: number): Promise<ApArtHistoryWorkRow> {
	const response = await apiFetch(`/api/ap-art-history/image-set/${number}`);
	return parseJsonResponse<ApArtHistoryWorkRow>(response, 'Failed to load work.');
}
