import { describe, expect, it } from 'vitest';
import { getAllowedClassNames } from '$lib/catalog/ap-classes';
import {
	AP_KNOWLEDGE_CATALOG_VERSION,
	getApCurriculumKnowledge,
	listApCurriculumCourseNames
} from '$lib/ap-knowledge/catalog';

describe('AP curriculum knowledge', () => {
	it('covers every supported real AP course', () => {
		const supportedRealCourses = [...getAllowedClassNames()].filter(
			(apClass) => !apClass.toLowerCase().includes('ap lunch')
		);

		expect(listApCurriculumCourseNames().sort()).toEqual(supportedRealCourses.sort());
	});

	it('provides an official source and aligned unit list for every curated course', () => {
		for (const apClass of listApCurriculumCourseNames()) {
			const result = getApCurriculumKnowledge({ apClass });
			expect(result.kind, apClass).toBe('course');
			if (result.kind !== 'course') continue;
			expect(result.units.length, apClass).toBeGreaterThan(0);
			expect(result.sources.length, apClass).toBeGreaterThan(0);
			for (const source of result.sources) {
				expect(source.url, apClass).toMatch(
					/^https:\/\/(apcentral|apstudents)\.collegeboard\.org\//
				);
			}
		}
	});

	it('safely resolves every current catalog unit without crossing unit content', () => {
		const catalog = getApCurriculumKnowledge({});
		expect(catalog.kind).toBe('catalog');
		if (catalog.kind !== 'catalog') return;
		for (const course of catalog.courses) {
			for (const unit of course.units) {
				const result = getApCurriculumKnowledge({ apClass: course.apClass, unit });
				expect(result.kind, `${course.apClass} — ${unit}`).toBe('unit');
				if (result.kind !== 'unit') continue;
				expect(result.unit.name, `${course.apClass} — ${unit}`).toBe(unit);
			}
		}
	});

	it('supports CSP big ideas and rejects stale Physics mappings', () => {
		const csp = getApCurriculumKnowledge({
			apClass: 'AP Computer Science Principles',
			unit: 'Big Idea 3: Algorithms and Programming'
		});
		expect(csp.kind).toBe('unit');
		if (csp.kind === 'unit') {
			expect(csp.unit.coverage).toBe('official_unit_title_only');
		}

		const physicsInduction = getApCurriculumKnowledge({
			apClass: 'AP Physics 2',
			unit: 'Unit 13: Electromagnetic Induction'
		});
		expect(physicsInduction.kind).toBe('not_found');

		const staleNumberWithCurrentTitle = getApCurriculumKnowledge({
			apClass: 'AP Physics 2',
			unit: 'Unit 15: Waves, Sound, and Physical Optics'
		});
		expect(staleNumberWithCurrentTitle.kind).toBe('not_found');

		const physicsOptics = getApCurriculumKnowledge({
			apClass: 'AP Physics 2',
			unit: 'Geometric Optics'
		});
		expect(physicsOptics.kind).toBe('unit');
		if (physicsOptics.kind === 'unit') {
			expect(physicsOptics.unit.name).toBe('Unit 13: Geometric Optics');
			expect(physicsOptics.unit.coverage).toBe('official_unit_title_only');
		}

		const statistics = getApCurriculumKnowledge({ apClass: 'AP Statistics' });
		expect(statistics.kind).toBe('course');
		if (statistics.kind === 'course') {
			expect(statistics.units).toHaveLength(5);
			expect(statistics.units.at(-1)?.name).toBe('Unit 5: Regression Analysis');
		}

		const spanish = getApCurriculumKnowledge({ apClass: 'AP Spanish Language' });
		expect(spanish.kind).toBe('course');
		if (spanish.kind === 'course') {
			expect(spanish.units[1]?.name).toBe('Unit 2: Language and Culture');
			expect(spanish.units.at(-1)?.name).toBe('Unit 6: Global Contexts');
		}
	});

	it('returns bounded factual knowledge for an exact unit', () => {
		const result = getApCurriculumKnowledge({
			apClass: 'AP Biology',
			unit: 'Unit 3: Cellular Energetics'
		});

		expect(result.kind).toBe('unit');
		if (result.kind !== 'unit') throw new Error('Expected unit knowledge');
		expect(result.course.apClass).toBe('AP Biology');
		expect(result.unit.name).toBe('Unit 3: Cellular Energetics');
		expect(result.unit.coverage).toBe('official_unit_title_only');
		expect(result.sources[0]?.url).toMatch(
			/^https:\/\/(apcentral|apstudents)\.collegeboard\.org\//
		);
		expect(result.sources[0]?.url).not.toContain('utm_');
	});

	it('matches a unit from a student-friendly partial title', () => {
		const result = getApCurriculumKnowledge({
			apClass: 'AP Biology',
			unit: 'cellular energetics'
		});

		expect(result.kind).toBe('unit');
		if (result.kind !== 'unit') throw new Error('Expected unit knowledge');
		expect(result.unit.name).toBe('Unit 3: Cellular Energetics');
	});

	it('returns a concise course map without copied curriculum prose', () => {
		const result = getApCurriculumKnowledge({ apClass: 'AP Calculus AB' });

		expect(result.kind).toBe('course');
		if (result.kind !== 'course') throw new Error('Expected course knowledge');
		expect(result.units).toHaveLength(8);
		expect(result.units[0]).toEqual(
			expect.objectContaining({ name: 'Unit 1: Limits and Continuity' })
		);
		expect(result.units[0]).not.toHaveProperty('description');
	});

	it('lists the catalog when no course is requested', () => {
		const result = getApCurriculumKnowledge({});

		expect(result.kind).toBe('catalog');
		if (result.kind !== 'catalog') throw new Error('Expected catalog knowledge');
		expect(result.catalogVersion).toBe(AP_KNOWLEDGE_CATALOG_VERSION);
		expect(result.courses).toHaveLength(25);
		expect(result.courses.some((course) => course.apClass === 'AP Lunch😂')).toBe(false);
	});

	it('fails safely for unsupported courses and units', () => {
		expect(getApCurriculumKnowledge({ unit: 'Unit 3' })).toEqual(
			expect.objectContaining({
				kind: 'not_found',
				message: expect.stringContaining('AP class')
			})
		);
		expect(getApCurriculumKnowledge({ apClass: 'AP Lunch😂' })).toEqual(
			expect.objectContaining({ kind: 'not_found' })
		);
		expect(
			getApCurriculumKnowledge({ apClass: 'AP Biology', unit: 'Unit 99: Time Travel' })
		).toEqual(
			expect.objectContaining({
				kind: 'not_found',
				availableUnits: expect.arrayContaining(['Unit 3: Cellular Energetics'])
			})
		);
	});
});
