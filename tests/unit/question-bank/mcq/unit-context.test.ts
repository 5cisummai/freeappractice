import { describe, expect, it } from 'vitest';
import { getCourses } from '$lib/catalog/ap-classes';
import {
	buildMcqGenerationPrompt,
	buildStimulusSetGenerationPrompt,
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

	it('embeds the local Examfig field reference into stimulus prompts', () => {
		const { system } = buildStimulusSetGenerationPrompt({
			className: 'AP Human Geography',
			unit: 'Unit 1: Thinking Geographically',
			childCount: 3,
			mode: 'diagram'
		});
		expect(system).toContain('EXAMFIG DIAGRAM REFERENCE - FOLLOW THIS EXACTLY');
		expect(system).toContain(
			'Allowed diagram types for AP Human Geography: map, table, data-plot, function-graph'
		);
		expect(system).toContain('map: regions[] is REQUIRED');
		expect(system).toContain('VALID MAP EXAMPLE');
		expect(system).toContain('factual real-world context');
		expect(system).toContain('anonymized subjects');
		expect(system).toContain('identifiable living people');
		expect(system).toContain('Do not add labels, titles, source disclaimers');
		expect(system).toContain('Original practice material');
	});

	it('omits unavailable diagram guidance instead of describing it as disabled', () => {
		const questionPrompt = buildMcqGenerationPrompt({
			className: 'AP Calculus AB',
			unit: 'Unit 1: Limits and Continuity',
			diagramsEnabled: false
		});
		const textStimulusPrompt = buildStimulusSetGenerationPrompt({
			className: 'AP Human Geography',
			unit: 'Unit 1: Thinking Geographically',
			childCount: 3,
			mode: 'text'
		});

		expect(questionPrompt.system).not.toContain('DIAGRAMS DISABLED');
		expect(questionPrompt.system).not.toContain('EXAMFIG DIAGRAM REFERENCE');
		expect(textStimulusPrompt.system).not.toContain('EXAMFIG DIAGRAM REFERENCE');
	});
});
