import { describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/neon-http';
import {
	frqServableQualityPredicate,
	mcqServableQualityPredicate
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
		expect(params).toEqual([]);
	});
});
