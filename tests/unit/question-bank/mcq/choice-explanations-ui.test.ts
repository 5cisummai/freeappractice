import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import McqAnswerChoices from '#lib/components/questions/mcq-answer-choices.svelte';

const choiceExplanations = {
	A: 'Alpha reasoning',
	B: 'Beta reasoning',
	C: 'Gamma reasoning',
	D: 'Delta reasoning'
};
const options = ['A', 'B', 'C', 'D'].map((id) => ({ id, label: id, text: `Choice ${id}` }));

describe('inline choice explanations', () => {
	it.each([
		{ hasCheckedAnswer: false, showFeedback: true, visible: false },
		{ hasCheckedAnswer: true, showFeedback: false, visible: false },
		{ hasCheckedAnswer: true, showFeedback: true, visible: true }
	])('respects reveal timing: %j', ({ visible, ...feedback }) => {
		const { body } = render(McqAnswerChoices, {
			props: { options, choiceExplanations, ...feedback, onSelect: () => {} }
		});
		for (const explanation of Object.values(choiceExplanations)) {
			expect(body.includes(explanation)).toBe(visible);
		}
	});
	it('keeps legacy choices renderable without explanations', () => {
		const { body } = render(McqAnswerChoices, {
			props: { options, hasCheckedAnswer: true, showFeedback: true, onSelect: () => {} }
		});
		expect(body).toContain('Choice A');
		expect(body).not.toContain('Alpha reasoning');
	});
});
