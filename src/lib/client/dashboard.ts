import { apiFetch } from '$lib/client/api.js';
import type { ProgressEntry, StatsData } from '$lib/types/user-stats.js';

export interface DashboardData {
	stats: StatsData | null;
	progress: ProgressEntry[];
}

/** Fetch stats and progress in parallel (same endpoints as dashboard pages). */
export async function fetchDashboardData(): Promise<DashboardData> {
	const [statsRes, progressRes] = await Promise.all([
		apiFetch('/api/auth/stats'),
		apiFetch('/api/auth/progress')
	]);

	let stats: StatsData | null = null;
	let progress: ProgressEntry[] = [];

	if (statsRes.ok) {
		stats = (await statsRes.json()) as StatsData;
	}
	if (progressRes.ok) {
		const data = (await progressRes.json()) as { progress?: ProgressEntry[] };
		progress = data.progress ?? [];
	}

	return { stats, progress };
}
