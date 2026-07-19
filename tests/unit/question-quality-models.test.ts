import { describe, expect, it } from 'vitest';
import {
	QuestionFeedback,
	QuestionQuality,
	QuestionQualityReviewJobItem
} from '$lib/question-quality/models.server';

function hasUniqueIndex(
	indexes: Array<[Record<string, unknown>, { unique?: boolean }]>,
	fields: string[]
) {
	return indexes.some(
		([keys, options]) =>
			options.unique === true &&
			fields.every((field) => Object.prototype.hasOwnProperty.call(keys, field))
	);
}

describe('question quality persistence invariants', () => {
	it('allows only one active quality record per canonical S3 question', () => {
		expect(hasUniqueIndex(QuestionQuality.schema.indexes(), ['questionId'])).toBe(true);
	});

	it('allows only one claimed job item per canonical S3 question', () => {
		expect(hasUniqueIndex(QuestionQualityReviewJobItem.schema.indexes(), ['questionId'])).toBe(
			true
		);
	});

	it('deduplicates the same feedback type from the same student', () => {
		expect(
			hasUniqueIndex(QuestionFeedback.schema.indexes(), ['questionId', 'userId', 'type'])
		).toBe(true);
	});
});
