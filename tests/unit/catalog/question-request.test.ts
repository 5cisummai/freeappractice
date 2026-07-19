import { describe, expect, it } from 'vitest';
import { validateQuestionRequest } from '$lib/catalog/question-request.server';

async function errorBody(result: ReturnType<typeof validateQuestionRequest>) {
	if (result.ok) throw new Error('expected failure');
	return { status: result.response.status, body: await result.response.json() };
}

describe('validateQuestionRequest', () => {
	it('accepts a valid class and unit', () => {
		const result = validateQuestionRequest({
			className: 'AP Biology',
			unit: 'Unit 1: Chemistry of Life',
			excludeQuestionIds: ['a', ' a ', 'b', '']
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value).toEqual({
			className: 'AP Biology',
			unit: 'Unit 1: Chemistry of Life',
			excludeQuestionIds: ['a', 'b']
		});
	});

	it('requires a non-empty supported className', async () => {
		expect((await errorBody(validateQuestionRequest({}))).status).toBe(400);
		expect((await errorBody(validateQuestionRequest({ className: '  ' }))).status).toBe(400);
		expect(
			(await errorBody(validateQuestionRequest({ className: 'Not A Real Class' }))).body.error
		).toMatch(/supported AP course/);
	});

	it('rejects oversized className and unit', async () => {
		expect((await errorBody(validateQuestionRequest({ className: 'A'.repeat(121) }))).status).toBe(
			400
		);
		expect(
			(await errorBody(validateQuestionRequest({ className: 'AP Biology', unit: 'u'.repeat(201) })))
				.status
		).toBe(400);
	});

	it('returns 410 when customTopic is provided', async () => {
		const result = await errorBody(
			validateQuestionRequest({ className: 'AP Biology', customTopic: 'mito' })
		);
		expect(result.status).toBe(410);
		expect(result.body.error).toMatch(/deprecated/);
	});

	it('rejects non-array excludeQuestionIds and non-string ids', async () => {
		expect(
			(
				await errorBody(
					validateQuestionRequest({ className: 'AP Biology', excludeQuestionIds: 'x' })
				)
			).status
		).toBe(400);
		expect(
			(
				await errorBody(
					validateQuestionRequest({
						className: 'AP Biology',
						excludeQuestionIds: [1]
					})
				)
			).status
		).toBe(400);
	});

	it('caps excludeQuestionIds at 100 unique ids', () => {
		const ids = Array.from({ length: 120 }, (_, i) => `id-${i}`);
		const result = validateQuestionRequest({
			className: 'AP Biology',
			excludeQuestionIds: ids
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.excludeQuestionIds).toHaveLength(100);
	});
});
