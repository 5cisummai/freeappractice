import { describe, expect, it } from 'vitest';
import { getCourses } from '#lib/catalog/courses.js';
import { selectValidCourses } from '#lib/users/course-selection.js';

describe('course selection', () => {
	const course = getCourses()[0]!.name;

	it('filters form values and removes duplicates while preserving order', () => {
		expect(selectValidCourses(['invalid', course, course])).toEqual([course]);
	});

	it('rejects invalid or empty API selections', () => {
		expect(selectValidCourses([course, 'invalid'], true)).toBeNull();
		expect(selectValidCourses([], true)).toBeNull();
	});
});
