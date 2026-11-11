import { describe, expect, it } from 'vitest';
import { loadExamBlueprint } from '#lib/exams/blueprints.js';

describe('loadExamBlueprint', () => {
	it('loads AP Biology with two timed MCQ and FRQ sections', () => {
		const result = loadExamBlueprint('AP Biology');
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.blueprint.courseId).toBe('ap-biology');
		expect(result.blueprint.sections).toHaveLength(2);
		const [mcq, frq] = result.blueprint.sections;
		expect(mcq).toMatchObject({
			id: 'multiple-choice',
			kind: 'mcq',
			questionCount: 60,
			timeLimitMs: 90 * 60_000,
			weightPercent: 50
		});
		expect(mcq.parts).toBeUndefined();
		expect(frq).toMatchObject({
			id: 'free-response',
			kind: 'frq',
			questionCount: 6,
			timeLimitMs: 90 * 60_000,
			weightPercent: 50
		});
		expect(result.blueprint.taskQuotas).toBeUndefined();
	});

	it('loads AP English Language with task quotas and reading-period note', () => {
		const result = loadExamBlueprint('AP English Language');
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const [mcq, frq] = result.blueprint.sections;
		expect(mcq).toMatchObject({
			questionCount: 45,
			timeLimitMs: 60 * 60_000,
			weightPercent: 45
		});
		expect(frq).toMatchObject({
			questionCount: 3,
			timeLimitMs: 135 * 60_000,
			weightPercent: 55
		});
		expect(frq.notes).toContain('Includes a 15-minute reading period.');
		expect(result.blueprint.taskQuotas).toEqual(['synthesis', 'rhetorical-analysis', 'argument']);
	});

	it('rejects unknown courses', () => {
		const result = loadExamBlueprint('Not A Real Course');
		expect(result).toEqual({ ok: false, reason: 'Unknown course "Not A Real Course".' });
	});

	it('rejects AP Computer Science Principles for incomplete sections and MCQ interaction', () => {
		const result = loadExamBlueprint('AP Computer Science Principles');
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(
			result.reason ===
				'Section "create-performance-task" is not supported for full-length exams.' ||
				result.reason === 'Section "create-performance-task" is missing questionCount.' ||
				result.reason.startsWith('Question type "multiple-select-two-answers"')
		).toBe(true);
	});

	it('loads AP Calculus AB with enforced calculator part timing', () => {
		const result = loadExamBlueprint('AP Calculus AB');
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		for (const section of result.blueprint.sections) {
			expect(section.parts?.length).toBe(2);
			expect(section.partPacing).toBe('enforced');
		}
	});

	it('loads AP World History with recommended DBQ and LEQ pacing', () => {
		const result = loadExamBlueprint('AP World History');
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const dbqLeq = result.blueprint.sections.find((section) => section.id === 'dbq-and-leq');
		expect(dbqLeq).toBeDefined();
		expect(dbqLeq?.partPacing).toBe('recommended');
		expect(dbqLeq?.parts?.map((part) => part.id)).toEqual(['dbq', 'leq']);
		expect(result.blueprint.taskQuotas?.length).toBeGreaterThan(1);
	});
});
