import { describe, expect, it } from 'vitest';
import {
	buildQuestionQualityPrompt,
	buildQuestionQualityWebSearchTool,
	extractWebSearchEvidence,
	extractResponseOutputText,
	parseAssessmentText,
	requiresWebSearchForQuestion
} from '$lib/question-quality/rubric.server';

describe('question quality rubric', () => {
	it('uses dedicated parody-course guidance', () => {
		expect(buildQuestionQualityPrompt({ apClass: 'AP Lunch' }).developer).toContain(
			'intentional parody course AP Lunch'
		);
		expect(buildQuestionQualityPrompt({ apClass: 'AP Biology' }).developer).toContain(
			'real AP Biology course framework'
		);
	});

	it('automatically marks malformed Markdown or formatting as BAD', () => {
		const prompt = buildQuestionQualityPrompt({ apClass: 'AP Biology' });

		expect(prompt.developer).toContain('Markdown or other formatting is malformed');
		expect(prompt.developer).toContain('return BAD automatically');
		expect(prompt.developer).toContain('MALFORMED_FORMATTING');
	});

	it('configures web grounding only for real AP courses', () => {
		expect(requiresWebSearchForQuestion({ apClass: 'AP Biology' })).toBe(true);
		expect(requiresWebSearchForQuestion({ apClass: 'AP Lunch' })).toBe(false);
		expect(buildQuestionQualityWebSearchTool('high')).toEqual({
			type: 'web_search',
			search_context_size: 'high'
		});
	});

	it('parses strict structured assessments', () => {
		const parsed = parseAssessmentText(
			JSON.stringify({
				verdict: 'bad',
				issue_codes: ['WRONG_KEY'],
				evidence: ['Choice B, not A, follows from the calculation.'],
				confidence: 0.99,
				requires_human_review: false
			}),
			{ model: 'test', inputTokens: 50, outputTokens: 20, estimatedCostUsd: 0.01 }
		);
		expect(parsed.verdict).toBe('bad');
		expect(parsed.issueCodes).toEqual(['WRONG_KEY']);
		expect(parsed.sourceUrls).toEqual([]);
	});

	it('extracts hosted search citations from a Responses result', () => {
		expect(
			extractWebSearchEvidence({
				output: [
					{
						type: 'web_search_call',
						action: { sources: [{ url: 'https://apcentral.collegeboard.org/example' }] }
					},
					{
						type: 'message',
						content: [
							{
								type: 'output_text',
								annotations: [{ type: 'url_citation', url: 'https://example.edu/fact' }]
							}
						]
					}
				]
			})
		).toEqual({
			sourceUrls: ['https://apcentral.collegeboard.org/example', 'https://example.edu/fact'],
			webSearchUsed: true
		});
	});

	it('extracts Responses API output text', () => {
		expect(
			extractResponseOutputText({
				output: [{ type: 'message', content: [{ type: 'output_text', text: '{"ok":true}' }] }]
			})
		).toBe('{"ok":true}');
	});
});
