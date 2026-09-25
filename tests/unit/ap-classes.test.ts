import { afterEach, describe, expect, it, vi } from 'vitest';
import { getUnitsForCourse, resolveEffectiveUnit } from '$lib/catalog/ap-courses';

const biologyUnits = getUnitsForCourse('AP Biology');

afterEach(() => vi.restoreAllMocks());

describe('resolveEffectiveUnit', () => {
	it('keeps an explicitly selected unit', () => {
		expect(resolveEffectiveUnit('AP Biology', biologyUnits[3]!)).toBe(biologyUnits[3]);
	});

	it('uses all units when no range is supplied', () => {
		vi.spyOn(Math, 'random').mockReturnValue(0.999);

		expect(resolveEffectiveUnit('AP Biology', '')).toBe(biologyUnits.at(-1));
	});

	it('picks only from the requested custom range', () => {
		vi.spyOn(Math, 'random').mockReturnValue(0.999);

		expect(resolveEffectiveUnit('AP Biology', '', [2, 4])).toBe(biologyUnits[4]);
	});

	it('normalizes reversed and out-of-bounds range values', () => {
		vi.spyOn(Math, 'random').mockReturnValue(0);

		expect(resolveEffectiveUnit('AP Biology', '', [999, -2])).toBe(biologyUnits[0]);
	});
});
