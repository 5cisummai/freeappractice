import { describe, expect, it } from 'vitest';
import { saveExamSchema, startExamSchema } from '#lib/exams/session.js';

const section = {
	id: 'section-1',
	kind: 'mcq',
	title: 'Section I',
	timeLimitMs: 60000,
	items: [{ id: 'item-1', questionId: 'question-1' }]
};

describe('exam session validation', () => {
	it('accepts a multi-section exam and rejects duplicate item and section IDs', () => {
		const frq = {
			...section,
			id: 'section-2',
			kind: 'frq',
			items: [{ id: 'item-2', questionId: 'question-2' }]
		};
		expect(startExamSchema.safeParse({ course: 'Biology', sections: [section, frq] }).success).toBe(
			true
		);
		expect(
			startExamSchema.safeParse({ course: 'Biology', sections: [section, section] }).success
		).toBe(false);
		expect(
			startExamSchema.safeParse({
				course: 'Biology',
				sections: [section, { ...frq, items: section.items }]
			}).success
		).toBe(false);
	});

	it('requires a revision and bounds response sizes', () => {
		expect(
			saveExamSchema.safeParse({ revision: 0, responses: { 'item-1': 'A' }, submit: true }).success
		).toBe(true);
		expect(saveExamSchema.safeParse({ responses: {} }).success).toBe(false);
		expect(
			saveExamSchema.safeParse({ revision: 0, responses: { 'item-1': 'x'.repeat(50001) } }).success
		).toBe(false);
	});
});
