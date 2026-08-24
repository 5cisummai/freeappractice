import { resolve } from '$app/paths';
import { formatDayInTimeZone } from '$lib/dates/calendar-day';
import type { HistoryItem, ProgressEntry, StatsData } from '$lib/users/types.js';

export const ALL_COURSES = 'all';
export const HISTORY_WINDOW_DAYS = 30;
export const MAX_HISTORY_DAYS = 90;
export const MIN_TOPIC_ATTEMPTS = 3;
export const MAX_STACKED_SERIES = 8;

export type CourseFilter = typeof ALL_COURSES | string;

export type NextFocus = {
	kind: 'topic' | 'unit';
	apClass: string;
	unit: string;
	topic?: string;
	mastery: number;
	attempts: number;
	reason: 'weakest' | 'recent-mistakes';
};

export type StackedActivitySeries = {
	key: string;
	label: string;
};

export type StackedActivityRow = {
	dayKey: string;
	date: Date;
	total: number;
	[key: string]: string | number | Date;
};

export type AccuracyDay = {
	date: Date;
	dayKey: string;
	accuracy: number | null;
	answered: number;
	correct: number;
};

export type AccuracyScopeRow = {
	label: string;
	answered: number;
	correct: number;
	accuracy: number;
};

export function availableCourses(
	progress: ProgressEntry[],
	stats: StatsData,
	selectedSubjects: string[]
): string[] {
	return [
		...new Set([
			...selectedSubjects,
			...stats.subjectBreakdown.map((subject) => subject.subject),
			...progress.map((entry) => entry.apClass)
		])
	]
		.filter(Boolean)
		.sort((a, b) => a.localeCompare(b));
}

export function filterProgress(progress: ProgressEntry[], course: CourseFilter): ProgressEntry[] {
	if (course === ALL_COURSES) return progress;
	return progress.filter((entry) => entry.apClass === course);
}

export function filterHistory(items: HistoryItem[], course: CourseFilter): HistoryItem[] {
	if (course === ALL_COURSES) return items;
	return items.filter((item) => item.attempt.apClass === course);
}

function scopeLabel(item: HistoryItem, course: CourseFilter): string {
	return course === ALL_COURSES ? item.attempt.apClass : item.attempt.unit || 'All units';
}

export function accuracyByScope(items: HistoryItem[], course: CourseFilter): AccuracyScopeRow[] {
	const totals = new Map<string, { answered: number; correct: number }>();

	for (const item of items) {
		const scored = scoredQuestions(item);
		if (scored.answered === 0) continue;
		const label = scopeLabel(item, course);
		const total = totals.get(label) ?? { answered: 0, correct: 0 };
		total.answered += scored.answered;
		total.correct += scored.correct;
		totals.set(label, total);
	}

	return [...totals.entries()]
		.map(([label, total]) => ({
			label,
			answered: total.answered,
			correct: total.correct,
			accuracy: Math.round((total.correct / total.answered) * 100)
		}))
		.sort((a, b) => a.label.localeCompare(b.label));
}

export function selectNextFocus(progress: ProgressEntry[]): NextFocus | null {
	const topicCandidates: Array<NextFocus & { recentMistakes: number; lastAttemptAt?: string }> = [];

	for (const entry of progress) {
		for (const topic of entry.topics ?? []) {
			if (topic.attempts < MIN_TOPIC_ATTEMPTS || topic.mastery === null) continue;
			topicCandidates.push({
				kind: 'topic',
				apClass: entry.apClass,
				unit: entry.unit,
				topic: topic.name,
				mastery: topic.mastery,
				attempts: topic.attempts,
				reason: (entry.recentMistakes ?? 0) > 0 ? 'recent-mistakes' : 'weakest',
				recentMistakes: entry.recentMistakes ?? 0,
				lastAttemptAt: topic.lastAttemptAt ?? entry.lastAttemptAt
			});
		}
	}

	if (topicCandidates.length > 0) {
		topicCandidates.sort((a, b) => {
			if (a.mastery !== b.mastery) return a.mastery - b.mastery;
			if (b.recentMistakes !== a.recentMistakes) return b.recentMistakes - a.recentMistakes;
			return timestamp(b.lastAttemptAt) - timestamp(a.lastAttemptAt);
		});
		const pick = topicCandidates[0];
		if (!pick) return null;
		return {
			kind: pick.kind,
			apClass: pick.apClass,
			unit: pick.unit,
			topic: pick.topic,
			mastery: pick.mastery,
			attempts: pick.attempts,
			reason: pick.reason
		};
	}

	const units = progress.filter((entry) => entry.totalAttempts > 0 || (entry.frqAttempts ?? 0) > 0);
	if (units.length === 0) return null;

	units.sort((a, b) => {
		if (a.mastery !== b.mastery) return a.mastery - b.mastery;
		return (b.recentMistakes ?? 0) - (a.recentMistakes ?? 0);
	});
	const unit = units[0];
	if (!unit) return null;
	return {
		kind: 'unit',
		apClass: unit.apClass,
		unit: unit.unit,
		mastery: unit.mastery,
		attempts: unit.totalAttempts + (unit.frqAttempts ?? 0),
		reason: (unit.recentMistakes ?? 0) > 0 ? 'recent-mistakes' : 'weakest'
	};
}

export function nextFocusCopy(focus: NextFocus): { heading: string; supporting: string } {
	const heading = focus.topic ? `${focus.unit} · ${focus.topic}` : focus.unit;
	const supporting =
		focus.reason === 'recent-mistakes'
			? 'You have missed this topic more often recently.'
			: focus.kind === 'topic'
				? 'This is currently your weakest practiced topic.'
				: 'This is currently your weakest practiced unit.';
	return { heading, supporting };
}

export function practiceHref(apClass: string, unit?: string, mode?: 'frq'): string {
	const params = new URLSearchParams();
	if (apClass) params.set('apClass', apClass);
	if (unit) params.set('unit', unit);
	if (mode) params.set('mode', mode);
	const query = params.toString();
	return query ? `${resolve('/app/practice')}?${query}` : resolve('/app/practice');
}

export function stackedActivityByScope(
	items: HistoryItem[],
	course: CourseFilter,
	days = HISTORY_WINDOW_DAYS,
	priorityLabels: string[] = []
): { rows: StackedActivityRow[]; series: StackedActivitySeries[] } {
	const buckets = emptyDayMap(days, () => new Map<string, number>());
	const labels = new Set<string>();
	const totals = new Map<string, number>();

	for (const item of items) {
		if (course !== ALL_COURSES && item.attempt.apClass !== course) continue;
		const label = scopeLabel(item, course);
		labels.add(label);
		totals.set(label, (totals.get(label) ?? 0) + 1);
		const bucket = buckets.get(localDayKey(item.attempt.attemptedAt));
		if (!bucket) continue;
		bucket.set(label, (bucket.get(label) ?? 0) + 1);
	}

	const prioritySet = new Set(priorityLabels);
	const rankedLabels = [...labels].sort((a, b) => {
		const priorityDifference = Number(prioritySet.has(b)) - Number(prioritySet.has(a));
		if (priorityDifference !== 0) return priorityDifference;
		return (totals.get(b) ?? 0) - (totals.get(a) ?? 0) || a.localeCompare(b);
	});
	const visibleLabels = rankedLabels.slice(0, MAX_STACKED_SERIES);
	const hasOther = rankedLabels.length > visibleLabels.length;
	const series = [
		...visibleLabels.map((label) => ({ key: `series-${stableKey(label)}`, label })),
		...(hasOther ? [{ key: 'series-other', label: 'Other' }] : [])
	];
	const overflowLabels = new Set(rankedLabels.slice(MAX_STACKED_SERIES));
	const rows = [...buckets.entries()].map(([dayKey, bucket]) => {
		const row: StackedActivityRow = {
			dayKey,
			date: dateFromDayKey(dayKey),
			total: 0
		};
		for (const item of series) {
			const count =
				item.label === 'Other'
					? [...overflowLabels].reduce((sum, label) => sum + (bucket.get(label) ?? 0), 0)
					: (bucket.get(item.label) ?? 0);
			row[item.key] = count;
			row.total += count;
		}
		return row;
	});

	return { rows, series };
}

function stableKey(value: string): string {
	let hash = 0;
	for (const character of value) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
	return hash.toString(36);
}

export function historyFromParam(days = HISTORY_WINDOW_DAYS, timeZone?: string): string {
	const start = daysAgo(days - 1);
	return formatDayInTimeZone(start, timeZone);
}

export function buildAccuracyDays(items: HistoryItem[], days = HISTORY_WINDOW_DAYS): AccuracyDay[] {
	const buckets = emptyDayMap(days, () => ({ answered: 0, correct: 0 }));
	for (const item of items) {
		const key = localDayKey(item.attempt.attemptedAt);
		const bucket = buckets.get(key);
		if (!bucket) continue;
		const scored = scoredQuestions(item);
		bucket.answered += scored.answered;
		bucket.correct += scored.correct;
	}
	return [...buckets.entries()].map(([dayKey, bucket]) => ({
		date: dateFromDayKey(dayKey),
		dayKey,
		answered: bucket.answered,
		correct: bucket.correct,
		accuracy: bucket.answered > 0 ? Math.round((bucket.correct / bucket.answered) * 100) : null
	}));
}

export function accuracyDayCount(days: AccuracyDay[]): number {
	return days.filter((day) => day.accuracy !== null).length;
}

export function hasPracticeActivity(stats: StatsData, progress: ProgressEntry[]): boolean {
	return (
		stats.overview.totalQuestions > 0 ||
		stats.overview.frqSubmissions > 0 ||
		progress.some((entry) => entry.totalAttempts > 0 || (entry.frqAttempts ?? 0) > 0)
	);
}

function scoredQuestions(item: HistoryItem): { answered: number; correct: number } {
	switch (item.kind) {
		case 'mcq':
			if (item.attempt.wasCorrect === undefined) return { answered: 0, correct: 0 };
			return { answered: 1, correct: item.attempt.wasCorrect ? 1 : 0 };
		case 'quiz':
			return { answered: item.attempt.answeredCount, correct: item.attempt.correctCount };
		case 'frq':
			return { answered: 0, correct: 0 };
		default: {
			const exhaustive: never = item;
			throw new Error(`Unhandled history kind: ${exhaustive}`);
		}
	}
}

function timestamp(value?: string): number {
	if (!value) return 0;
	const time = new Date(value).getTime();
	return Number.isNaN(time) ? 0 : time;
}

function daysAgo(days: number): Date {
	const date = new Date();
	date.setDate(date.getDate() - days);
	return date;
}

function localDayKey(iso: string): string {
	return formatDayInTimeZone(new Date(iso));
}

function dateFromDayKey(dayKey: string): Date {
	const [year, month, day] = dayKey.split('-').map(Number);
	return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, 12);
}

function emptyDayMap<T>(days: number, create: () => T): Map<string, T> {
	const map = new Map<string, T>();
	const start = daysAgo(days - 1);
	start.setHours(0, 0, 0, 0);
	for (let i = 0; i < days; i += 1) {
		const date = new Date(start);
		date.setDate(start.getDate() + i);
		map.set(formatDayInTimeZone(date), create());
	}
	return map;
}
