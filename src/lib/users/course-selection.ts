import { getCourses } from '#lib/catalog/courses.js';

const validCourses = new Set(getCourses().map((course) => course.name));

/** Filter form selections or strictly validate API selections before saving them. */
export function selectValidCourses(values: unknown[], strict = false): string[] | null {
	if (strict && (values.length === 0 || values.length > validCourses.size)) return null;
	const courses = values.filter(
		(value): value is string => typeof value === 'string' && validCourses.has(value)
	);
	if (courses.length === 0 || (strict && courses.length !== values.length)) return null;
	return [...new Set(courses)];
}
