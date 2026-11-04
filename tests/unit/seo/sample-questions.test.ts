import { describe, expect, it } from 'vitest';
import { getPageBySlug } from '#lib/catalog/practice-pages.js';
import sampleQuestionsSnapshot from '#lib/seo/data/unit-sample-questions.json';
import {
	buildSampleQuestionsJsonLd,
	buildSeoSampleQuestionsSnapshot,
	selectSeoSampleQuestions,
	type SeoSampleQuestionCandidate,
	type SeoSampleQuestionsSnapshot
} from '#lib/seo/sample-questions.js';

function candidate(
	overrides: Partial<SeoSampleQuestionCandidate> & Pick<SeoSampleQuestionCandidate, 'questionId'>
): SeoSampleQuestionCandidate {
	return {
		course: 'AP Biology',
		unit: 'Unit 1: Chemistry of Life',
		question: 'Which property of water matters most here?',
		optionA: 'High specific heat',
		optionB: 'Low density as a solid',
		optionC: 'Neutral pH',
		optionD: 'Ionic bonding',
		correctAnswer: 'A',
		explanation: 'Water resists temperature change because of hydrogen bonding.',
		...overrides
	};
}

describe('selectSeoSampleQuestions', () => {
	it('sorts by question id and keeps at most five', () => {
		const selected = selectSeoSampleQuestions([
			candidate({ questionId: 'c' }),
			candidate({ questionId: 'a' }),
			candidate({ questionId: 'f' }),
			candidate({ questionId: 'b' }),
			candidate({ questionId: 'e' }),
			candidate({ questionId: 'd' })
		]);
		expect(selected.map((question) => question.questionId)).toEqual(['a', 'b', 'c', 'd', 'e']);
	});

	it('skips diagram and stimulus questions and empty options', () => {
		const selected = selectSeoSampleQuestions([
			candidate({ questionId: 'diagram', hasDiagram: true }),
			candidate({ questionId: 'stimulus', stimulus: { text: 'A passage' } }),
			candidate({ questionId: 'blank-option', optionC: '   ' }),
			candidate({ questionId: 'keep' })
		]);
		expect(selected.map((question) => question.questionId)).toEqual(['keep']);
	});
});

describe('buildSeoSampleQuestionsSnapshot', () => {
	it('keys samples by unit slug and omits units with no eligible questions', () => {
		const unitPage = getPageBySlug('ap-biology/unit-1');
		const otherPage = getPageBySlug('ap-biology/unit-2');
		expect(unitPage).not.toBeNull();
		expect(otherPage).not.toBeNull();

		const snapshot = buildSeoSampleQuestionsSnapshot(
			[
				candidate({ questionId: 'bio-1' }),
				candidate({
					questionId: 'wrong-unit',
					unit: 'Unit 99: Not a real unit'
				})
			],
			[unitPage!, otherPage!]
		);

		expect(
			snapshot.questionsBySlug['ap-biology/unit-1']?.map((question) => question.questionId)
		).toEqual(['bio-1']);
		expect(snapshot.questionsBySlug['ap-biology/unit-2']).toBeUndefined();
	});
});

describe('committed sample-question snapshot', () => {
	it('covers every catalog unit page with 3 to 5 questions', () => {
		const snapshot = sampleQuestionsSnapshot as SeoSampleQuestionsSnapshot;
		const slugs = Object.keys(snapshot.questionsBySlug);
		expect(slugs.length).toBeGreaterThan(100);
		expect(slugs.every((slug) => slug.includes('/unit-'))).toBe(true);
		for (const questions of Object.values(snapshot.questionsBySlug)) {
			expect(questions.length).toBeGreaterThanOrEqual(3);
			expect(questions.length).toBeLessThanOrEqual(5);
		}
	});
});

describe('buildSampleQuestionsJsonLd', () => {
	it('returns quiz JSON-LD only when a unit has samples', () => {
		const unitPage = getPageBySlug('ap-biology/unit-1');
		const coursePage = getPageBySlug('ap-biology');
		expect(unitPage).not.toBeNull();
		expect(coursePage).not.toBeNull();

		const samples = selectSeoSampleQuestions([candidate({ questionId: 'bio-1' })]);
		expect(buildSampleQuestionsJsonLd(coursePage!, samples)).toBeNull();
		expect(buildSampleQuestionsJsonLd(unitPage!, [])).toBeNull();

		const jsonLd = buildSampleQuestionsJsonLd(unitPage!, samples);
		expect(jsonLd).toMatchObject({
			'@type': 'Quiz',
			isAccessibleForFree: true
		});
		expect(jsonLd?.hasPart).toEqual([
			expect.objectContaining({
				'@type': 'Question',
				acceptedAnswer: expect.objectContaining({
					text: 'A. High specific heat'
				})
			})
		]);
	});
});
