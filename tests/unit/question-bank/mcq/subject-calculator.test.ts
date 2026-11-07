import { describe, expect, it } from 'vitest';
import { getSubjectCalculator } from '#lib/question-bank/mcq/subject-calculator.js';

describe('getSubjectCalculator', () => {
	it.each([
		['AP Calculus AB', 'graphing'],
		['AP Calculus BC', 'graphing'],
		['AP Statistics', 'graphing'],
		['AP Precalculus', 'graphing'],
		['AP Biology', 'scientific'],
		['AP Chemistry', 'scientific'],
		['AP Physics 1', 'scientific'],
		['AP Physics 2', 'scientific'],
		['AP Physics C: Mechanics', 'scientific'],
		['AP Physics C: E&M', 'scientific'],
		['AP Environmental Science', 'scientific'],
		['AP English Language', 'none'],
		['', 'none']
	] as const)('%s -> %s', (course, expected) => {
		expect(getSubjectCalculator(course)).toBe(expected);
	});
});
