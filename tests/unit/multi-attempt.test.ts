import { describe, expect, it } from 'vitest';
import { assignPracticeVariant } from '$lib/practice/assign-practice-variant.server';
import {
	buildAttemptFieldsFromMultiAttempt,
	hasValidHints,
	hasPracticeExperimentMetadata,
	isMultiAttemptRequestBody,
	resolveDisplayedVariant,
	validateMultiAttemptPayload
} from '$lib/practice/multi-attempt';
import { createMultiAttemptState, reduceMultiAttempt } from '$lib/practice/multi-attempt-machine';

describe('assignPracticeVariant', () => {
	it('is sticky for the same user and experiment version', () => {
		const a = assignPracticeVariant('user-123');
		const b = assignPracticeVariant('user-123');
		expect(a).toBe(b);
	});

	it('splits users across both variants', () => {
		const variants = new Set(
			Array.from({ length: 40 }, (_, i) => assignPracticeVariant(`user-${i}`))
		);
		expect(variants.has('control')).toBe(true);
		expect(variants.has('multi_attempt_hints')).toBe(true);
	});
});

describe('resolveDisplayedVariant', () => {
	it('falls back to control when hints are missing', () => {
		expect(
			resolveDisplayedVariant({
				assigned: 'multi_attempt_hints',
				experimentEnabled: true,
				questionHasHints: false
			})
		).toEqual({ displayed: 'control', fallbackReason: 'missing_hints' });
	});

	it('serves treatment only when assigned and hint-eligible', () => {
		expect(
			resolveDisplayedVariant({
				assigned: 'multi_attempt_hints',
				experimentEnabled: true,
				questionHasHints: true
			})
		).toEqual({ displayed: 'multi_attempt_hints', fallbackReason: 'none' });
	});
});

describe('hasValidHints', () => {
	it('requires both non-empty hints', () => {
		expect(hasValidHints({ hint1: 'a', hint2: 'b' })).toBe(true);
		expect(hasValidHints({ hint1: 'a', hint2: '  ' })).toBe(false);
		expect(hasValidHints({})).toBe(false);
	});
});

describe('validateMultiAttemptPayload + first-vs-final semantics', () => {
	it('keeps first-answer correctness for stats while recording final answer', () => {
		const validated = validateMultiAttemptPayload(
			{
				answers: ['A', 'C'],
				terminalOutcome: 'correct',
				hintsShown: 1,
				displayedVariant: 'multi_attempt_hints'
			},
			'C'
		);
		expect(validated.ok).toBe(true);
		if (!validated.ok) return;
		const fields = buildAttemptFieldsFromMultiAttempt(validated.data, 'C');
		expect(fields.selectedAnswer).toBe('A');
		expect(fields.wasCorrect).toBe(false);
		expect(fields.finalAnswer).toBe('C');
		expect(fields.answerCount).toBe(2);
		expect(fields.hintsShown).toBe(1);
	});

	it('rejects repeating a known-wrong choice', () => {
		const validated = validateMultiAttemptPayload(
			{
				answers: ['A', 'A'],
				terminalOutcome: 'revealed',
				hintsShown: 1,
				displayedVariant: 'multi_attempt_hints'
			},
			'C'
		);
		expect(validated.ok).toBe(false);
	});

	it('rejects client-provided hint counts that do not match the answers', () => {
		const validated = validateMultiAttemptPayload(
			{
				answers: ['A', 'C'],
				terminalOutcome: 'correct',
				hintsShown: 0,
				displayedVariant: 'multi_attempt_hints'
			},
			'C'
		);
		expect(validated).toEqual({
			ok: false,
			error: 'hintsShown does not match the submitted answers'
		});
	});
});

describe('isMultiAttemptRequestBody backwards compatibility', () => {
	it('recognizes experiment metadata without changing the classic payload shape', () => {
		expect(
			hasPracticeExperimentMetadata({
				selectedAnswer: 'A',
				displayedVariant: 'control',
				experimentKey: 'multi_attempt_hints',
				experimentVersion: 1
			})
		).toBe(true);
	});

	it('treats classic selectedAnswer-only payloads as control', () => {
		expect(
			isMultiAttemptRequestBody({
				questionId: 'q1',
				selectedAnswer: 'A',
				timeTakenMs: 1200
			})
		).toBe(false);
	});

	it('detects treatment payloads via answers array', () => {
		expect(
			isMultiAttemptRequestBody({
				questionId: 'q1',
				answers: ['A', 'B'],
				terminalOutcome: 'revealed',
				hintsShown: 1,
				displayedVariant: 'multi_attempt_hints'
			})
		).toBe(true);
	});
});

describe('multi-attempt state machine', () => {
	it('shows hint 1 then hint 2 then max_attempts', () => {
		let state = createMultiAttemptState();
		state = reduceMultiAttempt(state, { type: 'submit', answer: 'A', correctAnswer: 'D' });
		expect(state.phase).toBe('hinted');
		expect(state.hintsShown).toBe(1);
		expect(state.lockedChoices).toEqual(['A']);

		state = reduceMultiAttempt(state, { type: 'submit', answer: 'B', correctAnswer: 'D' });
		expect(state.hintsShown).toBe(2);

		state = reduceMultiAttempt(state, { type: 'submit', answer: 'C', correctAnswer: 'D' });
		expect(state.phase).toBe('terminal');
		expect(state.terminalOutcome).toBe('max_attempts');
	});

	it('ends on later correct without rewriting first-answer correctness', () => {
		let state = createMultiAttemptState();
		state = reduceMultiAttempt(state, { type: 'submit', answer: 'A', correctAnswer: 'D' });
		state = reduceMultiAttempt(state, { type: 'submit', answer: 'D', correctAnswer: 'D' });
		expect(state.terminalOutcome).toBe('correct');
		expect(state.firstAnswerCorrect).toBe(false);
		expect(state.resolvedCorrect).toBe(true);
	});

	it('supports explicit reveal', () => {
		let state = createMultiAttemptState();
		state = reduceMultiAttempt(state, { type: 'submit', answer: 'A', correctAnswer: 'D' });
		state = reduceMultiAttempt(state, { type: 'reveal' });
		expect(state.terminalOutcome).toBe('revealed');
		expect(state.phase).toBe('terminal');
	});
});
