import { describe, expect, it } from 'vitest';
import { getFocusedPracticeHref } from '$lib/catalog/practice-pages';

describe('getFocusedPracticeHref', () => {
	it('uses the canonical class practice page when no unit is selected', () => {
		expect(getFocusedPracticeHref('AP Biology')).toBe('/practice/ap-biology');
	});

	it('uses the canonical unit practice page when the selected unit exists', () => {
		expect(getFocusedPracticeHref('AP Biology', 'Unit 3: Cellular Energetics')).toBe(
			'/practice/ap-biology/unit-3'
		);
	});

	it('falls back to the class page for an unrecognized unit', () => {
		expect(getFocusedPracticeHref('AP Biology', 'Unit 99: Not a real unit')).toBe(
			'/practice/ap-biology'
		);
	});
});
