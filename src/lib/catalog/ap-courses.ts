import { APP_COURSES, type ApCourse } from '$lib/data/ap-data';

const courses: ApCourse[] = APP_COURSES;

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
	return new Set(courses.map((c) => c.name));
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
