import { describe, expect, it } from 'vitest';
import { getCourses } from '$lib/catalog/ap-classes';
import {
	buildMcqGenerationPrompt,
	getUnitContextData
} from '$lib/question-bank/mcq/generation.server';

describe('MCQ unit context (exact catalog keys)', () => {
	it('covers every unified AP course and unit exactly once', () => {
		for (const course of getCourses()) {
			const catalogUnits = [...course.semester1, ...course.semester2];
			for (const unit of catalogUnits) {
				const ctx = getUnitContextData(course.name, unit);
				expect(ctx, `${course.name} — ${unit}`).not.toBeNull();
				expect(
					(ctx?.topics.length ?? 0) + (ctx?.keywords.length ?? 0),
					`${course.name} — ${unit}`
				).toBeGreaterThan(0);
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
		expect(system).toContain('UNIT FOCUS: Unit 1: Limits and Continuity');
		expect(system).not.toContain('COURSE-GUIDANCE:');
		expect(system).toMatch(/REQUIRED KEYWORDS\/CONSTRAINTS:|MAIN TOPIC OPTIONS:/);
	});
});
