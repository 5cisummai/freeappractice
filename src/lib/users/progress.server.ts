import type { IProgress } from '$lib/users/records.server';
import type { IUserProfile } from '$lib/users/model.server';
import type { ProgressEntry } from '$lib/users/types';
import type { FrqProgressSummary } from '$lib/frq/types';

export function findOrCreateProgressEntry(
	progress: IProgress[],
	apClass: string,
	unit: string
): IProgress {
	let entry = progress.find((p) => p.apClass === apClass && p.unit === unit);
	if (!entry) {
		progress.push({
			apClass,
			unit,
			completed: false,
			mastery: 0,
			totalAttempts: 0,
			correctAttempts: 0
		});
		entry = progress[progress.length - 1];
	}
	return entry;
}

export function buildProgressData(user: IUserProfile): ProgressEntry[] {
	return (user.progress ?? []).map((entry) => ({
		apClass: entry.apClass,
		unit: entry.unit,
		totalAttempts: entry.totalAttempts,
		correctAttempts: entry.correctAttempts,
		mastery: entry.mastery,
		lastAttemptAt: entry.lastAttemptAt?.toISOString()
	}));
}

export function mergeFrqProgress(
	mcqProgress: ProgressEntry[],
	frqProgress: FrqProgressSummary[]
): ProgressEntry[] {
	const byKey = new Map(
		mcqProgress.map((entry) => [`${entry.apClass}\u0000${entry.unit}`, { ...entry }])
	);
	for (const frq of frqProgress) {
		const key = `${frq.apClass}\u0000${frq.unit}`;
		const entry = byKey.get(key) ?? {
			apClass: frq.apClass,
			unit: frq.unit,
			totalAttempts: 0,
			correctAttempts: 0,
			mastery: 0
		};
		entry.frqAttempts = frq.attempts;
		entry.frqPointsEarned = frq.pointsEarned;
		entry.frqPointsAvailable = frq.pointsAvailable;
		entry.frqAveragePercentage = frq.averagePercentage;
		entry.frqLastAttemptAt = frq.lastAttemptAt;
		byKey.set(key, entry);
	}
	return [...byKey.values()];
}
