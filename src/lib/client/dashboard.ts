import { apiFetch, ApiError, getResponseMessage, readJsonOrNull, type ApiMessageResponse } from '$lib/client/api.js';
import type { ProgressEntry, StatsData } from '$lib/types/user-stats.js';

export interface DashboardData {
	stats: StatsData | null;
	progress: ProgressEntry[];
	error?: string;
}

/** Fetch stats and progress in parallel (same endpoints as dashboard pages). */
export async function fetchDashboardData(): Promise<DashboardData> {
	const [statsRes, progressRes] = await Promise.all([
		apiFetch('/api/me/stats'),
		apiFetch('/api/me/progress')
	]);

	if (statsRes.status === 401 || progressRes.status === 401) {
		return { stats: null, progress: [], error: 'Session expired. Please sign in again.' };
	}

	let stats: StatsData | null = null;
	let progress: ProgressEntry[] = [];
	let error: string | undefined;

	if (statsRes.ok) {
		stats = (await statsRes.json()) as StatsData;
	} else {
		const payload = await readJsonOrNull<ApiMessageResponse>(statsRes);
		error = getResponseMessage(payload, 'Failed to load stats.');
	}

	if (progressRes.ok) {
		const data = (await progressRes.json()) as { progress?: ProgressEntry[] };
		progress = data.progress ?? [];
	} else if (!error) {
		const payload = await readJsonOrNull<ApiMessageResponse>(progressRes);
		error = getResponseMessage(payload, 'Failed to load progress.');
	}

	return { stats, progress, error };
}

export { ApiError };
