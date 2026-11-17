import { describe, expect, it } from 'vitest';
import { and, eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-http';
import {
	frqServableQualityPredicate,
	mcqServableQualityPredicate,
	ownQualityNotBadPredicate
} from '#lib/question-bank/quality/serving-filter.server.js';
import { frqQuestions, mcqQuestions } from '#lib/server/neon/schema.js';

describe('quality serving filters', () => {
	const db = drizzle('postgresql://test:test@localhost/test');

	it('excludes finalized-bad MCQs and stimulus/set siblings from the serving pool', () => {
		const { sql, params } = db
			.select({ questionId: mcqQuestions.questionId })
			.from(mcqQuestions)
			.where(mcqServableQualityPredicate())
			.toSQL();
		expect(sql).toContain('final_verdict');
		expect(sql).toContain('bad');
		expect(sql).toContain('stimulusId');
		expect(sql).toContain('stimulus');
		expect(sql).toContain('set');
		expect(sql).toContain('shared_quality');
		expect(params).toEqual([]);
	});

	it('excludes finalized-bad FRQs from the serving pool', () => {
		const { sql, params } = db
			.select({ questionId: frqQuestions.questionId })
			.from(frqQuestions)
			.where(frqServableQualityPredicate())
			.toSQL();
		expect(sql).toContain('final_verdict');
		expect(sql).toContain('bad');
		expect(sql).not.toContain('shared_quality');
		expect(params).toEqual([]);
	});

	it('own-quality filter skips the stimulus sibling scan', () => {
		const { sql, params } = db
			.select({ questionId: mcqQuestions.questionId, data: mcqQuestions.data })
			.from(mcqQuestions)
			.where(
				and(
					inArray(mcqQuestions.questionId, ['q1', 'q2', 'q3', 'q4', 'q5']),
					eq(mcqQuestions.active, true),
					ownQualityNotBadPredicate(mcqQuestions.questionId)
				)
			)
			.toSQL();
		expect(sql).toContain('own_quality');
		expect(sql).toContain('final_verdict');
		expect(sql).not.toContain('shared_quality');
		expect(sql).not.toContain('shared_question');
		expect(sql).not.toContain('stimulusId');
		expect(params).toEqual(['q1', 'q2', 'q3', 'q4', 'q5', true]);
	});
});
