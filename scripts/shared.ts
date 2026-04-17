/**
 * Shared utilities for cache management scripts.
 */

import apClassesData from '../src/lib/data/ap-classes.json';

// ── Arg parsing ─────────────────────────────────────────────

/** Read the value after a CLI flag, e.g. `--class "AP Biology"` returns `"AP Biology"`. */
export function getArg(flag: string): string | undefined {
	const idx = process.argv.indexOf(flag);
	return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : undefined;
}

// ── Concurrency limiter ─────────────────────────────────────

/**
 * Creates a simple concurrency limiter that allows at most `max` concurrent async tasks.
 * Returns a `limit()` wrapper: `await limit(() => doWork())`.
 */
export function createLimiter(max: number) {
	let running = 0;
	const queue: Array<() => void> = [];

	function next() {
		if (running >= max || queue.length === 0) return;
		running++;
		queue.shift()!();
	}

	return async function limit<T>(fn: () => Promise<T>): Promise<T> {
		await new Promise<void>((resolve) => {
			queue.push(resolve);
			next();
		});
		try {
			return await fn();
		} finally {
			running--;
			next();
		}
	};
}

// ── Course loading ──────────────────────────────────────────

export interface Course {
	name: string;
	semester1: string[];
	semester2: string[];
}

export interface ClassUnitCombo {
	className: string;
	unit: string;
}

/**
 * Load courses from ap-classes.json and build class+unit combos.
 * Optionally filter by a single class name (case-insensitive).
 * Exits with error if filterClass doesn't match any course.
 */
export function loadCombos(filterClass?: string | null): {
	courses: Course[];
	combos: ClassUnitCombo[];
} {
	let courses = (apClassesData as { courses: Course[] }).courses;

	if (filterClass) {
		courses = courses.filter((c) => c.name.toLowerCase() === filterClass.toLowerCase());
		if (courses.length === 0) {
			console.error(`No course found matching "${filterClass}".`);
			process.exit(1);
		}
	}

	const combos: ClassUnitCombo[] = [];
	for (const course of courses) {
		for (const unit of [...course.semester1, ...course.semester2]) {
			combos.push({ className: course.name, unit });
		}
	}

	return { courses, combos };
}
