import type { IProgress } from '$lib/users/records.server';
import type { IUserProfile } from '$lib/users/model.server';
import type { ProgressEntry } from '$lib/users/types';

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
