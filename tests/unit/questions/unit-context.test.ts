import { describe, expect, it } from 'vitest';
import { getCourses } from '$lib/catalog/ap-classes';
import unitDescriptions from '$lib/data/unit-descriptionsrevised.json';
import { buildMcqGenerationPrompt, getUnitContextData } from '$lib/questions/generation.server';

describe('MCQ unit context (exact catalog keys)', () => {
	it('covers every ap-classes.json course and unit exactly once', () => {
		const data = unitDescriptions as {
			courses: Array<{ apClass: string; units: Array<{ unit: string }> }>;
		};

		const descCourses = new Map(data.courses.map((course) => [course.apClass, course]));
		expect(descCourses.size).toBe(getCourses().length);

		for (const course of getCourses()) {
			const desc = descCourses.get(course.name);
			expect(desc, `missing descriptions course: ${course.name}`).toBeTruthy();
			if (!desc) continue;

			const catalogUnits = [...course.semester1, ...course.semester2];
			const descUnits = desc.units.map((unit) => unit.unit);
			expect(descUnits, course.name).toEqual(catalogUnits);

			for (const unit of catalogUnits) {
				const ctx = getUnitContextData(course.name, unit);
				expect(ctx, `${course.name} — ${unit}`).not.toBeNull();
				expect(ctx?.description.length, `${course.name} — ${unit}`).toBeGreaterThan(0);
			}
		}
	});

	it('resolves by exact strings only (no fuzzy fallback)', () => {
		expect(getUnitContextData('AP Biology', 'Unit 1: Chemistry of Life')).not.toBeNull();
		expect(getUnitContextData('AP Biology', 'Chemistry of Life')).toBeNull();
		expect(getUnitContextData('APBIO', 'Unit 1: Chemistry of Life')).toBeNull();
		expect(getUnitContextData('AP Biology', 'Unit 1')).toBeNull();
	});

	it('embeds deterministic unit context into the MCQ generation prompt', () => {
		const { system } = buildMcqGenerationPrompt({
			className: 'AP Calculus AB',
			unit: 'Unit 1: Limits and Continuity'
		});
		expect(system).toContain('UNIT CONTEXT: Unit 1: Limits and Continuity');
		expect(system).toContain('COURSE-GUIDANCE:');
		expect(system).toMatch(/REQUIRED KEYWORDS\/CONSTRAINTS:|Key Topics:/);
	});
});
