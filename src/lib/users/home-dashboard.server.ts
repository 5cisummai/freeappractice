import { AP_DATA } from '#lib/catalog/dataset.js';
import type { ProgressEntry, StatsData } from '#lib/users/types.js';

/** Home subject cards measure progress toward this many MCQ attempts. */
export const SUBJECT_PROGRESS_GOAL = 100;

export type SelectedCourseEntry = {
	/** Stable catalog identifier when known (for example `ap-biology`). */
	id: string;
	/** Canonical course name used by practice APIs. */
	name: string;
	/** Student-facing label. Currently matches `name`. */
	displayName: string;
};

export type HomeCourseCard = SelectedCourseEntry & {
	/** Graded MCQ attempts for this course in the selected practice namespace. */
	answered: number;
	/** `answered` capped at {@link SUBJECT_PROGRESS_GOAL}. */
	shown: number;
	/**
	 * Progress toward {@link SUBJECT_PROGRESS_GOAL} MCQ attempts, floored and
	 * capped at 100. Matches the web home dashboard definition.
	 */
	percent: number;
	/** Latest MCQ attempt timestamp across units, or null when never practiced. */
	lastPracticedAt: string | null;
};

export type HomeRecommendation = {
	/** Recommendation rule used by the web home dashboard. */
	rule: 'most_recently_practiced_selected_course_else_first_selected';
	course: HomeCourseCard | null;
};

const courseIdByName = new Map(AP_DATA.courses.map((course) => [course.name, course.id] as const));

export function toSelectedCourseEntry(name: string): SelectedCourseEntry {
	const trimmed = name.trim();
	return {
		id: courseIdByName.get(trimmed) ?? trimmed,
		name: trimmed,
		displayName: trimmed
	};
}

export function buildSelectedCourseEntries(courseNames: string[]): SelectedCourseEntry[] {
	return courseNames.map(toSelectedCourseEntry);
}

function lastMcqAtByCourse(progress: ProgressEntry[]): Map<string, string> {
	const map = new Map<string, string>();
	for (const entry of progress) {
		if (!entry.lastAttemptAt) continue;
		const current = map.get(entry.course);
		if (!current || entry.lastAttemptAt > current) {
			map.set(entry.course, entry.lastAttemptAt);
		}
	}
	return map;
}

/** Build ordered selected-course cards, including courses with no activity. */
export function buildHomeCourseCards(
	selectedCourses: string[],
	stats: StatsData,
	progress: ProgressEntry[]
): HomeCourseCard[] {
	const answeredByCourse = new Map(
		(stats.courseBreakdown ?? []).map((entry) => [entry.course, entry.total] as const)
	);
	const lastPracticed = lastMcqAtByCourse(progress);

	return selectedCourses.map((name) => {
		const answered = answeredByCourse.get(name) ?? 0;
		const shown = Math.min(answered, SUBJECT_PROGRESS_GOAL);
		const percent = Math.min(
			Math.floor((answered / SUBJECT_PROGRESS_GOAL) * 100),
			SUBJECT_PROGRESS_GOAL
		);
		return {
			...toSelectedCourseEntry(name),
			answered,
			shown,
			percent,
			lastPracticedAt: lastPracticed.get(name) ?? null
		};
	});
}

/**
 * Recommend the most recently practiced selected course; fall back to the first
 * selected course when none have practice activity.
 */
export function recommendHomeCourse(courses: HomeCourseCard[]): HomeRecommendation {
	if (courses.length === 0) {
		return {
			rule: 'most_recently_practiced_selected_course_else_first_selected',
			course: null
		};
	}

	let best = courses[0]!;
	for (const course of courses) {
		if (!course.lastPracticedAt) continue;
		if (!best.lastPracticedAt || course.lastPracticedAt > best.lastPracticedAt) {
			best = course;
		}
	}

	return {
		rule: 'most_recently_practiced_selected_course_else_first_selected',
		course: best
	};
}
