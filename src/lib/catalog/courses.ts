import { AP_DATA, type UnifiedCourse } from '#lib/catalog/dataset.js';

const courseByName = new Map(AP_DATA.courses.map((course) => [course.name, course] as const));

export type ApCourse = {
	name: string;
	semester1: string[];
	semester2: string[];
};

/** Courses with MCQ practice enabled in the app catalog. */
export function isMcqPracticeCourse(course: string): boolean {
	const match = courseByName.get(course);
	return match?.app.practice.mcq.enabled === true;
}

function appUnitLabels(course: UnifiedCourse, semester: 1 | 2): string[] {
	return course.units.filter((unit) => unit.app.semester === semester).map((unit) => unit.label);
}

/** The app-facing course/unit selector catalog, reconstructed from normalized unit records. */
const courses: ApCourse[] = AP_DATA.courses.map((course) => ({
	name: course.name,
	semester1: appUnitLabels(course, 1),
	semester2: appUnitLabels(course, 2)
}));

/** All supported AP courses from catalog data. */
export function getCourses(): ApCourse[] {
	return courses;
}

export function getUnitsForCourse(course: string): string[] {
	const match = courses.find((c) => c.name === course);
	if (!match) return [];
	return [...match.semester1, ...match.semester2];
}

export function getAllowedCourses(): Set<string> {
	return new Set(getCourseNames().filter(isMcqPracticeCourse));
}

/** When "All Units" is selected (unit === ''), pick a random real unit for the course. */
export function resolveEffectiveUnit(
	course: string,
	unit: string,
	unitRange?: readonly number[]
): string {
	if (unit.trim()) return unit.trim();
	const allUnits = getUnitsForCourse(course);
	if (!allUnits.length) return '';

	const maxIndex = allUnits.length - 1;
	const start = Math.min(Math.max(Math.trunc(unitRange?.[0] ?? 0), 0), maxIndex);
	const end = Math.min(Math.max(Math.trunc(unitRange?.[1] ?? maxIndex), 0), maxIndex);
	const firstIndex = Math.min(start, end);
	const lastIndex = Math.max(start, end);
	const index = firstIndex + Math.floor(Math.random() * (lastIndex - firstIndex + 1));

	return allUnits[index]!;
}

/** Canonical app-facing names shared by selectors and agent tools. */
export function getCourseNames(): string[] {
	return courses.map((course) => course.name);
}
