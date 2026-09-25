import { describe, expect, it } from 'vitest';
import { validateQuestionRequest } from '$lib/catalog/question-request.server';

async function errorBody(result: ReturnType<typeof validateQuestionRequest>) {
	if (result.ok) throw new Error('expected failure');
	return { status: result.response.status, body: await result.response.json() };
}

describe('validateQuestionRequest', () => {
	it('accepts a valid class and unit', () => {
		const result = validateQuestionRequest({
			course: 'AP Biology',
			unit: 'Unit 1: Chemistry of Life',
			excludeQuestionIds: ['a', ' a ', 'b', '']
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value).toEqual({
			course: 'AP Biology',
			unit: 'Unit 1: Chemistry of Life',
			excludeQuestionIds: ['a', 'b']
		});
	});

	it('requires a non-empty supported course', async () => {
		expect((await errorBody(validateQuestionRequest({}))).status).toBe(400);
		expect((await errorBody(validateQuestionRequest({ course: '  ' }))).status).toBe(400);
		expect(
			(await errorBody(validateQuestionRequest({ course: 'Not A Real Class' }))).body.error
		).toMatch(/supported AP course/);
	});

	it('rejects oversized course and unit', async () => {
		expect((await errorBody(validateQuestionRequest({ course: 'A'.repeat(121) }))).status).toBe(
			400
		);
		expect(
			(await errorBody(validateQuestionRequest({ course: 'AP Biology', unit: 'u'.repeat(201) })))
				.status
		).toBe(400);
	});

	it('rejects unit aliases outside the course catalog', async () => {
		const result = await errorBody(
			validateQuestionRequest({ course: 'AP Biology', unit: 'Unit 1' })
		);
		expect(result.status).toBe(400);
		expect(result.body.error).toMatch(/supported course unit/);
	});

	it('returns 410 when customTopic is provided', async () => {
		const result = await errorBody(
			validateQuestionRequest({ course: 'AP Biology', customTopic: 'mito' })
		);
		expect(result.status).toBe(410);
		expect(result.body.error).toMatch(/deprecated/);
	});

	it('rejects non-array excludeQuestionIds and non-string ids', async () => {
		expect(
			(await errorBody(validateQuestionRequest({ course: 'AP Biology', excludeQuestionIds: 'x' })))
				.status
		).toBe(400);
		expect(
			(
				await errorBody(
					validateQuestionRequest({
						course: 'AP Biology',
						excludeQuestionIds: [1]
					})
				)
			).status
		).toBe(400);
	});

	it('caps excludeQuestionIds at 100 unique ids', () => {
		const ids = Array.from({ length: 120 }, (_, i) => `id-${i}`);
		const result = validateQuestionRequest({
			course: 'AP Biology',
			excludeQuestionIds: ids
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.excludeQuestionIds).toHaveLength(100);
	});
});
