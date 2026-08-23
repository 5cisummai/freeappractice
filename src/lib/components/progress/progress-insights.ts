import { resolve } from '$app/paths';
import type { HistoryItem, ProgressEntry, StatsData } from '$lib/users/types.js';
import { FRQ_PASS_THRESHOLD } from '$lib/users/history-constants.js';

export const ALL_COURSES = 'all';
export const HISTORY_WINDOW_DAYS = 30;
export const MAX_HISTORY_DAYS = 90;
export const MIN_TOPIC_ATTEMPTS = 3;
export const MAX_STACKED_SERIES = 8;
const HIGH_MASTERY = 75;

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

export type InsightItem = {
	id: string;
	title: string;
	detail: string;
	href: string | null;
	tone: 'positive' | 'attention';
};

export type MasteryBarRow = {
	label: string;
	unit: string;
	apClass: string;
	mastery: number;
	attempts: number;
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

export type ActivityDay = {
	date: Date;
	dayKey: string;
	mcq: number;
	frq: number;
	quiz: number;
};

export type PracticeMixSlice = {
	type: 'mcq' | 'frq' | 'quiz';
	label: string;
	count: number;
	color: string;
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

export function accuracyByScope(items: HistoryItem[], course: CourseFilter): AccuracyScopeRow[] {
	const totals = new Map<string, { answered: number; correct: number }>();

	for (const item of items) {
		if (course !== ALL_COURSES && item.attempt.apClass !== course) continue;
		const scored = scoredQuestions(item);
		if (scored.answered === 0) continue;
		const label = course === ALL_COURSES ? item.attempt.apClass : item.attempt.unit || 'All units';
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

export function masteryByUnit(progress: ProgressEntry[], course: CourseFilter): MasteryBarRow[] {
	const showCourse = course === ALL_COURSES;
	return progress
		.filter((entry) => entry.totalAttempts > 0 || (entry.frqAttempts ?? 0) > 0)
		.map((entry) => ({
			label: showCourse ? `${entry.apClass} · ${entry.unit}` : entry.unit || 'All units',
			unit: entry.unit,
			apClass: entry.apClass,
			mastery: entry.mastery,
			attempts: entry.totalAttempts
		}))
		.sort((a, b) => a.mastery - b.mastery || a.label.localeCompare(b.label));
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
		const label = course === ALL_COURSES ? item.attempt.apClass : item.attempt.unit || 'All units';
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

export function subjectMetrics(
	stats: StatsData,
	course: CourseFilter
): {
	accuracy: number;
	totalQuestions: number;
	frqAveragePercentage: number;
	frqAttempts: number;
	currentStreak: number;
} {
	if (course === ALL_COURSES) {
		return {
			accuracy: stats.overview.accuracy,
			totalQuestions: stats.overview.totalQuestions,
			frqAveragePercentage: stats.overview.frqAveragePercentage,
			frqAttempts: stats.overview.frqSubmissions,
			currentStreak: stats.overview.currentStreak
		};
	}

	const subject = stats.subjectBreakdown.find((item) => item.subject === course);
	return {
		accuracy: subject?.accuracy ?? 0,
		totalQuestions: subject?.total ?? 0,
		frqAveragePercentage: subject?.frqAveragePercentage ?? 0,
		frqAttempts: subject?.frqAttempts ?? 0,
		currentStreak: stats.overview.currentStreak
	};
}

export function historyFromParam(days = HISTORY_WINDOW_DAYS): string {
	const start = startOfLocalDay(daysAgo(days - 1));
	return formatLocalDay(start);
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

export function buildActivityDays(items: HistoryItem[], days = HISTORY_WINDOW_DAYS): ActivityDay[] {
	const buckets = emptyDayMap(days, () => ({ mcq: 0, frq: 0, quiz: 0 }));
	for (const item of items) {
		const key = localDayKey(item.attempt.attemptedAt);
		const bucket = buckets.get(key);
		if (!bucket) continue;
		switch (item.kind) {
			case 'mcq':
				bucket.mcq += 1;
				break;
			case 'frq':
				bucket.frq += 1;
				break;
			case 'quiz':
				bucket.quiz += 1;
				break;
			default: {
				const exhaustive: never = item;
				throw new Error(`Unhandled history kind: ${exhaustive}`);
			}
		}
	}
	return [...buckets.entries()].map(([dayKey, bucket]) => ({
		date: dateFromDayKey(dayKey),
		dayKey,
		...bucket
	}));
}

export function buildPracticeMix(items: HistoryItem[]): PracticeMixSlice[] {
	const counts = { mcq: 0, frq: 0, quiz: 0 };
	for (const item of items) {
		switch (item.kind) {
			case 'mcq':
				counts.mcq += 1;
				break;
			case 'frq':
				counts.frq += 1;
				break;
			case 'quiz':
				counts.quiz += 1;
				break;
			default: {
				const exhaustive: never = item;
				throw new Error(`Unhandled history kind: ${exhaustive}`);
			}
		}
	}
	const slices: PracticeMixSlice[] = [
		{ type: 'mcq', label: 'MCQ', count: counts.mcq, color: 'var(--color-mcq)' },
		{ type: 'frq', label: 'FRQ', count: counts.frq, color: 'var(--color-frq)' },
		{ type: 'quiz', label: 'Quiz', count: counts.quiz, color: 'var(--color-quiz)' }
	];
	return slices.filter((slice) => slice.count > 0);
}

export function accuracyDayCount(days: AccuracyDay[]): number {
	return days.filter((day) => day.accuracy !== null).length;
}

export function weeklyAccuracyDelta(items: HistoryItem[]): number | null {
	const recent = windowAccuracy(items, 0, 7);
	const previous = windowAccuracy(items, 7, 14);
	if (recent === null || previous === null) return null;
	return recent - previous;
}

export function recentWins(
	progress: ProgressEntry[],
	items: HistoryItem[],
	accuracyDelta: number | null
): InsightItem[] {
	const insights: InsightItem[] = [];

	const strongTopics = progress
		.flatMap((entry) =>
			(entry.topics ?? [])
				.filter(
					(topic) =>
						topic.mastery !== null &&
						topic.mastery >= HIGH_MASTERY &&
						topic.attempts >= MIN_TOPIC_ATTEMPTS
				)
				.map((topic) => ({ entry, topic, mastery: topic.mastery as number }))
		)
		.sort((a, b) => b.mastery - a.mastery)
		.slice(0, 2);

	for (const { entry, topic, mastery } of strongTopics) {
		insights.push({
			id: `win-topic-${entry.apClass}-${entry.unit}-${topic.name}`,
			title: `${entry.unit} · ${topic.name}`,
			detail: `${mastery}% mastery`,
			href: practiceHref(entry.apClass, entry.unit),
			tone: 'positive'
		});
	}

	const improvedUnits = progress
		.filter((entry) => typeof entry.recentDelta === 'number' && entry.recentDelta > 0)
		.sort((a, b) => (b.recentDelta ?? 0) - (a.recentDelta ?? 0))
		.slice(0, 2);

	for (const entry of improvedUnits) {
		insights.push({
			id: `win-delta-${entry.apClass}-${entry.unit}`,
			title: entry.unit,
			detail: `Improved ${entry.recentDelta}% recently`,
			href: practiceHref(entry.apClass, entry.unit),
			tone: 'positive'
		});
	}

	if (accuracyDelta !== null && accuracyDelta > 0) {
		insights.push({
			id: 'win-accuracy',
			title: 'Recent accuracy',
			detail: `Improved ${accuracyDelta}% this week`,
			href: resolve('/app/practice'),
			tone: 'positive'
		});
	}

	const strongFrq = items
		.filter((item) => item.kind === 'frq' && item.attempt.percentage >= FRQ_PASS_THRESHOLD)
		.slice(0, 1);
	for (const item of strongFrq) {
		if (item.kind !== 'frq') continue;
		insights.push({
			id: `win-frq-${item.attempt.id}`,
			title: 'FRQ performance',
			detail: `${item.attempt.percentage}% on ${item.attempt.unit}`,
			href: practiceHref(item.attempt.apClass, item.attempt.unit, 'frq'),
			tone: 'positive'
		});
	}

	return uniqueInsights(insights).slice(0, 4);
}

export function needsAttention(progress: ProgressEntry[], items: HistoryItem[]): InsightItem[] {
	const insights: InsightItem[] = [];
	const weakTopics = progress
		.flatMap((entry) =>
			(entry.topics ?? [])
				.filter(
					(topic) =>
						topic.mastery !== null &&
						topic.attempts >= MIN_TOPIC_ATTEMPTS &&
						topic.mastery < HIGH_MASTERY
				)
				.map((topic) => ({ entry, topic, mastery: topic.mastery as number }))
		)
		.sort((a, b) => a.mastery - b.mastery)
		.slice(0, 2);

	for (const { entry, topic, mastery } of weakTopics) {
		insights.push({
			id: `need-topic-${entry.apClass}-${entry.unit}-${topic.name}`,
			title: `${entry.unit} · ${topic.name}`,
			detail: `${mastery}% mastery`,
			href: practiceHref(entry.apClass, entry.unit),
			tone: 'attention'
		});
	}

	const declining = progress
		.filter((entry) => typeof entry.recentDelta === 'number' && entry.recentDelta < 0)
		.sort((a, b) => (a.recentDelta ?? 0) - (b.recentDelta ?? 0))
		.slice(0, 2);

	for (const entry of declining) {
		insights.push({
			id: `need-delta-${entry.apClass}-${entry.unit}`,
			title: entry.unit,
			detail: `Down ${Math.abs(entry.recentDelta ?? 0)}% recently`,
			href: practiceHref(entry.apClass, entry.unit),
			tone: 'attention'
		});
	}

	const mistakeUnits = progress
		.filter((entry) => (entry.recentMistakes ?? 0) > 0)
		.sort((a, b) => (b.recentMistakes ?? 0) - (a.recentMistakes ?? 0))
		.slice(0, 2);

	for (const entry of mistakeUnits) {
		const count = entry.recentMistakes ?? 0;
		insights.push({
			id: `need-mistakes-${entry.apClass}-${entry.unit}`,
			title: 'Recent incorrect answers',
			detail: `${count} in ${entry.unit}`,
			href: practiceHref(entry.apClass, entry.unit),
			tone: 'attention'
		});
	}

	const repeats = repeatedIncorrectCount(items);
	if (repeats > 0) {
		insights.push({
			id: 'need-repeats',
			title: 'Repeated mistakes',
			detail: `${repeats} question${repeats === 1 ? '' : 's'} missed more than once`,
			href: resolve('/app/practice'),
			tone: 'attention'
		});
	}

	return uniqueInsights(insights).slice(0, 4);
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

function windowAccuracy(
	items: HistoryItem[],
	startDaysAgo: number,
	endDaysAgo: number
): number | null {
	const start = startOfLocalDay(daysAgo(endDaysAgo - 1)).getTime();
	const end = startOfLocalDay(daysAgo(startDaysAgo)).getTime() + 86_400_000 - 1;
	let answered = 0;
	let correct = 0;
	for (const item of items) {
		const time = new Date(item.attempt.attemptedAt).getTime();
		if (time < start || time > end) continue;
		const scored = scoredQuestions(item);
		answered += scored.answered;
		correct += scored.correct;
	}
	if (answered === 0) return null;
	return Math.round((correct / answered) * 100);
}

function repeatedIncorrectCount(items: HistoryItem[]): number {
	const misses = new Map<string, number>();
	for (const item of items) {
		if (item.kind !== 'mcq' || item.attempt.wasCorrect !== false) continue;
		const key = item.attempt.questionId;
		misses.set(key, (misses.get(key) ?? 0) + 1);
	}
	return [...misses.values()].filter((count) => count >= 2).length;
}

function uniqueInsights(insights: InsightItem[]): InsightItem[] {
	const seen = new Set<string>();
	return insights.filter((insight) => {
		if (seen.has(insight.id)) return false;
		seen.add(insight.id);
		return true;
	});
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

function startOfLocalDay(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatLocalDay(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

function localDayKey(iso: string): string {
	return formatLocalDay(new Date(iso));
}

function dateFromDayKey(dayKey: string): Date {
	const [year, month, day] = dayKey.split('-').map(Number);
	return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, 12);
}

function emptyDayMap<T>(days: number, create: () => T): Map<string, T> {
	const map = new Map<string, T>();
	const start = startOfLocalDay(daysAgo(days - 1));
	for (let i = 0; i < days; i += 1) {
		const date = new Date(start);
		date.setDate(start.getDate() + i);
		map.set(formatLocalDay(date), create());
	}
	return map;
}
