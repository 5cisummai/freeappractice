import type { IProgress } from '$lib/users/records.server';
import type { IUserProfile } from '$lib/users/model.server';
import type { MasteryTopic, ProgressEntry } from '$lib/users/types';
import type { FrqProgressSummary } from '$lib/frq/types';
import { getQuestionsLookupMap } from '$lib/questions/storage.server';

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

const DELTA_WINDOW = 10;
const DELTA_MIN_WINDOW = 5;

/**
 * Improvement in MCQ accuracy between the 10 most recent attempts in a unit and
 * the 10 before that. Undefined until both windows have enough attempts.
 */
function computeRecentDelta(
	attempts: { apClass: string; unit: string; wasCorrect?: boolean; attemptedAt: Date }[],
	apClass: string,
	unit: string
): number | undefined {
	const unitAttempts = attempts
		.filter(
			(attempt) =>
				attempt.apClass === apClass &&
				(attempt.unit ?? '') === unit &&
				attempt.wasCorrect !== undefined
		)
		.sort((a, b) => new Date(b.attemptedAt).getTime() - new Date(a.attemptedAt).getTime());
	if (unitAttempts.length < DELTA_WINDOW + DELTA_MIN_WINDOW) return undefined;

	const recent = unitAttempts.slice(0, DELTA_WINDOW);
	const previous = unitAttempts.slice(DELTA_WINDOW, DELTA_WINDOW * 2);
	if (previous.length < DELTA_MIN_WINDOW) return undefined;

	const accuracy = (window: typeof recent) =>
		(window.filter((attempt) => attempt.wasCorrect).length / window.length) * 100;
	return Math.round(accuracy(recent) - accuracy(previous));
}

function computeRecentMistakes(
	attempts: { apClass: string; unit: string; wasCorrect?: boolean; attemptedAt: Date }[],
	apClass: string,
	unit: string
): number {
	return attempts
		.filter(
			(attempt) =>
				attempt.apClass === apClass && (attempt.unit ?? '') === unit && attempt.wasCorrect === false
		)
		.sort((a, b) => new Date(b.attemptedAt).getTime() - new Date(a.attemptedAt).getTime())
		.slice(0, 10).length;
}

export function buildProgressData(user: IUserProfile): ProgressEntry[] {
	const attempts = (user.questionHistory ?? []).map((attempt) => ({
		apClass: attempt.apClass,
		unit: attempt.unit ?? '',
		wasCorrect: attempt.wasCorrect,
		attemptedAt: attempt.attemptedAt
	}));
	return (user.progress ?? []).map((entry) => {
		const result: ProgressEntry = {
			apClass: entry.apClass,
			unit: entry.unit,
			totalAttempts: entry.totalAttempts,
			correctAttempts: entry.correctAttempts,
			mastery: entry.mastery,
			lastAttemptAt: entry.lastAttemptAt?.toISOString()
		};
		if (attempts.length) {
			result.recentDelta = computeRecentDelta(attempts, entry.apClass, entry.unit);
			result.recentMistakes = computeRecentMistakes(attempts, entry.apClass, entry.unit);
		}
		return result;
	});
}

function topicName(value: string): string {
	return value
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/[.!?]+$/, '');
}

export async function addTopicProgressData(
	progress: ProgressEntry[],
	user: Pick<IUserProfile, 'questionHistory'>
): Promise<ProgressEntry[]> {
	const attempts = user.questionHistory ?? [];
	const lookup = await getQuestionsLookupMap([
		...new Set(attempts.map((attempt) => attempt.questionId))
	]);
	const topicsByUnit = new Map<string, Map<string, MasteryTopic>>();

	for (const attempt of attempts) {
		const rawTopic = lookup.get(attempt.questionId)?.topicsCovered?.trim();
		if (!rawTopic) continue;
		const name = topicName(rawTopic);
		if (!name) continue;
		const unitKey = `${attempt.apClass}\u0000${attempt.unit}`;
		const byTopic = topicsByUnit.get(unitKey) ?? new Map<string, MasteryTopic>();
		const topic = byTopic.get(name) ?? {
			name,
			attempts: 0,
			correctAttempts: 0,
			mastery: null
		};
		topic.attempts += 1;
		if (attempt.wasCorrect !== undefined) {
			topic.mastery = Math.round(
				((topic.correctAttempts + (attempt.wasCorrect ? 1 : 0)) / topic.attempts) * 100
			);
			if (attempt.wasCorrect) topic.correctAttempts += 1;
		}
		topic.lastAttemptAt = attempt.attemptedAt.toISOString();
		byTopic.set(name, topic);
		topicsByUnit.set(unitKey, byTopic);
	}

	return progress.map((entry) => ({
		...entry,
		topics: [...(topicsByUnit.get(`${entry.apClass}\u0000${entry.unit}`)?.values() ?? [])].sort(
			(a, b) => b.attempts - a.attempts || a.name.localeCompare(b.name)
		)
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
		entry.lastAttemptAt ??= frq.lastAttemptAt;
		byKey.set(key, entry);
	}
	return [...byKey.values()];
}
