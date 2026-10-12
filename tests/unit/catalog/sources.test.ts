import { describe, expect, it } from 'vitest';
import { getAllowedCourses, getUnitsForCourse, getCourseNames } from '$lib/catalog/courses';
import { CATALOG_VERSION, getCatalogFacts } from '$lib/catalog/sources';

describe('catalog facts and official sources', () => {
	it('covers every supported real AP course', () => {
		const supportedRealCourses = [...getAllowedCourses()];

		expect(getCourseNames().sort()).toEqual(supportedRealCourses.sort());
	});

	it('provides an official source and aligned unit list for every curated course', () => {
		for (const course of getCourseNames()) {
			const result = getCatalogFacts({ course });
			expect(result.kind, course).toBe('course');
			if (result.kind !== 'course') continue;
			expect(result.units.length, course).toBeGreaterThan(0);
			expect(result.sources.length, course).toBeGreaterThan(0);
			for (const source of result.sources) {
				expect(source.url, course).toMatch(
					/^https:\/\/(apcentral|apstudents)\.collegeboard\.org\//
				);
			}
		}
	});

	it('uses the app course name exactly', () => {
		const canonical = getCatalogFacts({ course: 'AP US Government' });
		expect(canonical.kind).toBe('course');
		if (canonical.kind === 'course') {
			expect(canonical.course.course).toBe('AP US Government');
			expect(canonical.units).toHaveLength(5);
		}
		expect(getCatalogFacts({ course: 'AP U.S. Government and Politics' }).kind).toBe('not_found');
	});

	it('safely resolves every current catalog unit without crossing unit content', () => {
		const catalog = getCatalogFacts({});
		expect(catalog.kind).toBe('catalog');
		if (catalog.kind !== 'catalog') return;
		for (const course of catalog.courses) {
			for (const unit of course.units) {
				const result = getCatalogFacts({ course: course.course, unit });
				expect(result.kind, `${course.course} — ${unit}`).toBe('unit');
				if (result.kind !== 'unit') continue;
				expect(result.unit.name, `${course.course} — ${unit}`).toBe(unit);
			}
		}
	});

	it('uses current app unit labels', () => {
		const csp = getCatalogFacts({
			course: 'AP Computer Science Principles',
			unit: 'Big Idea 3: Algorithms and Programming'
		});
		expect(csp.kind).toBe('unit');
		if (csp.kind === 'unit') {
			expect(csp.unit.coverage).toBe('official_unit_title_only');
		}

		const physicsInduction = getCatalogFacts({
			course: 'AP Physics 2',
			unit: 'Unit 13: Electromagnetic Induction'
		});
		expect(physicsInduction.kind).toBe('unit');

		const staleNumberWithCurrentTitle = getCatalogFacts({
			course: 'AP Physics 2',
			unit: 'Unit 15: Waves, Sound, and Physical Optics'
		});
		expect(staleNumberWithCurrentTitle.kind).toBe('unit');

		const physicsOptics = getCatalogFacts({
			course: 'AP Physics 2',
			unit: 'Geometric Optics'
		});
		expect(physicsOptics.kind).toBe('not_found');

		const statistics = getCatalogFacts({ course: 'AP Statistics' });
		expect(statistics.kind).toBe('course');
		if (statistics.kind === 'course') {
			expect(statistics.units.map((unit) => unit.name)).toEqual(getUnitsForCourse('AP Statistics'));
		}

		const spanish = getCatalogFacts({ course: 'AP Spanish Language' });
		expect(spanish.kind).toBe('course');
		if (spanish.kind === 'course') {
			expect(spanish.units.map((unit) => unit.name)).toEqual(
				getUnitsForCourse('AP Spanish Language')
			);
		}
	});

	it('returns bounded factual knowledge for an exact unit', () => {
		const result = getCatalogFacts({
			course: 'AP Biology',
			unit: 'Unit 3: Cellular Energetics'
		});

		expect(result.kind).toBe('unit');
		if (result.kind !== 'unit') throw new Error('Expected unit knowledge');
		expect(result.course.course).toBe('AP Biology');
		expect(result.unit.name).toBe('Unit 3: Cellular Energetics');
		expect(result.unit.coverage).toBe('official_unit_title_only');
		expect(result.sources[0]?.url).toMatch(
			/^https:\/\/(apcentral|apstudents)\.collegeboard\.org\//
		);
		expect(result.sources[0]?.url).not.toContain('utm_');
	});

	it('requires the app unit label', () => {
		const result = getCatalogFacts({
			course: 'AP Biology',
			unit: 'cellular energetics'
		});

		expect(result.kind).toBe('not_found');
	});

	it('returns a concise course map without copied curriculum prose', () => {
		const result = getCatalogFacts({ course: 'AP Calculus AB' });

		expect(result.kind).toBe('course');
		if (result.kind !== 'course') throw new Error('Expected course knowledge');
		expect(result.units).toHaveLength(8);
		expect(result.units[0]).toEqual(
			expect.objectContaining({ name: 'Unit 1: Limits and Continuity' })
		);
		expect(result.units[0]).not.toHaveProperty('description');
	});

	it('lists the catalog when no course is requested', () => {
		const result = getCatalogFacts({});

		expect(result.kind).toBe('catalog');
		if (result.kind !== 'catalog') throw new Error('Expected catalog knowledge');
		expect(result.catalogVersion).toBe(CATALOG_VERSION);
		expect(result.courses).toHaveLength(25);
	});

	it('fails safely for unsupported courses and units', () => {
		expect(getCatalogFacts({ unit: 'Unit 3' })).toEqual(
			expect.objectContaining({
				kind: 'not_found',
				message: expect.stringContaining('AP course')
			})
		);
		expect(getCatalogFacts({ course: 'AP Biology', unit: 'Unit 99: Time Travel' })).toEqual(
			expect.objectContaining({
				kind: 'not_found',
				availableUnits: expect.arrayContaining(['Unit 3: Cellular Energetics'])
			})
		);
	});
});
