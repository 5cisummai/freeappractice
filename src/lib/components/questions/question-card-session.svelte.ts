import { apiFetch, readJsonOrNull } from '$lib/client/api.js';
import {
	captureFirstAnswerSubmitted,
	captureQuestionRequestFailed,
	captureQuestionRequestSucceeded,
	QuestionRequestError,
	type QuestionSource
} from '$lib/client/activation-analytics';
import { capturePostHogEvent } from '$lib/client/posthog-analytics';
import { resolveEffectiveUnit } from '$lib/catalog/ap-classes';
import { requestMcqQuestion } from '$lib/questions/request-mcq.client';
import {
	hasValidHints,
	MULTI_ATTEMPT_EXPERIMENT_KEY,
	MULTI_ATTEMPT_EXPERIMENT_VERSION,
	normalizeAnswerLetter,
	resolveDisplayedVariant,
	type PracticeVariant
} from '$lib/practice/multi-attempt';
import {
	createMultiAttemptState,
	reduceMultiAttempt,
	type MultiAttemptMachineState
} from '$lib/practice/multi-attempt-machine';
import type { AnswerResult, GeneratedQuestion, QuestionCardProps } from '$lib/questions/types';

type PracticeExperimentResponse = {
	assignedVariant: PracticeVariant;
	experimentEnabled: boolean;
	experimentKey: string;
	experimentVersion: number;
};

export type QuestionCardSessionOpts = {
	getSelectedClass: () => string;
	getSelectedUnit: () => string;
	getUnitRange: () => readonly number[] | undefined;
	getRequestVersion: () => number;
	getQuestionNumber: () => string;
	getAutoShowExplanation: () => boolean;
	getSelectedOption: () => string | null;
	getMounted: () => boolean;
	setSelectedOption: (value: string | null) => void;
	onCheckAnswer?: QuestionCardProps['onCheckAnswer'];
	onSkip?: QuestionCardProps['onSkip'];
	onNotLearned?: QuestionCardProps['onNotLearned'];
	onAnswered?: QuestionCardProps['onAnswered'];
};

export function createQuestionCardSession(opts: QuestionCardSessionOpts) {
	let hasCheckedAnswer = $state(false);
	let checkedSelection = $state<string | null>(null);
	let answerResult = $state<AnswerResult | null>(null);
	let showExplanation = $state(false);
	let startedAtMs = $state(Date.now());
	let isLoading = $state(false);
	let questionCount = $state(0);
	let statusMessage = $state('');
	let currentQuestion = $state<GeneratedQuestion | null>(null);
	let seenQuestionIds = $state<string[]>([]);
	let assignedVariant = $state<PracticeVariant>('control');
	let experimentEnabled = $state(false);
	let displayedVariant = $state<PracticeVariant>('control');
	let multiAttemptState = $state<MultiAttemptMachineState>(createMultiAttemptState());
	let questionFeedbackReason = $state<string | null>(null);

	const effectiveQuestionNumber = $derived(opts.getQuestionNumber() || `${questionCount}`);
	const isTreatmentActive = $derived(displayedVariant === 'multi_attempt_hints');
	const lockedChoices = $derived(isTreatmentActive ? multiAttemptState.lockedChoices : []);
	const activeHintText = $derived.by(() => {
		if (!isTreatmentActive || multiAttemptState.phase !== 'hinted') return null;
		if (multiAttemptState.hintsShown === 1) return currentQuestion?.hint1?.trim() ?? null;
		if (multiAttemptState.hintsShown === 2) return currentQuestion?.hint2?.trim() ?? null;
		return null;
	});
	const feedbackMessage = $derived.by(() => {
		if (activeHintText) return activeHintText;
		if (!hasCheckedAnswer || !answerResult || !currentQuestion?.correctAnswer) {
			return statusMessage;
		}
		if (answerResult.isCorrect === true) {
			return 'Correct! Nice work.';
		}
		if (answerResult.isCorrect === undefined) return 'Answer revealed.';
		if (
			answerResult.displayedVariant === 'multi_attempt_hints' &&
			answerResult.finalAnswer === answerResult.correctAnswer &&
			!answerResult.isCorrect
		) {
			return 'Solved after hints.';
		}
		return `Incorrect. Correct answer: ${answerResult.correctAnswer}.`;
	});
	const showEmptyState = $derived(
		opts.getMounted() && !isLoading && opts.getRequestVersion() === 0 && !currentQuestion
	);

	function rememberSeenQuestion(question: GeneratedQuestion): void {
		const questionId = question.questionId?.trim() ?? '';
		if (!questionId || seenQuestionIds.includes(questionId)) return;
		seenQuestionIds = [...seenQuestionIds, questionId];
	}

	function resetInteractionState(clearSelection = true): void {
		hasCheckedAnswer = false;
		checkedSelection = null;
		answerResult = null;
		showExplanation = false;
		questionFeedbackReason = null;
		multiAttemptState = createMultiAttemptState();
		startedAtMs = Date.now();
		if (clearSelection) opts.setSelectedOption(null);
	}

	async function fetchPracticeExperiment(): Promise<void> {
		try {
			const response = await apiFetch('/api/me/practice-experiment');
			if (response.status === 401 || !response.ok) {
				assignedVariant = 'control';
				experimentEnabled = false;
				return;
			}
			const payload = await readJsonOrNull<PracticeExperimentResponse>(response);
			if (!payload) {
				assignedVariant = 'control';
				experimentEnabled = false;
				return;
			}
			assignedVariant =
				payload.assignedVariant === 'multi_attempt_hints' ? 'multi_attempt_hints' : 'control';
			experimentEnabled = Boolean(payload.experimentEnabled);
		} catch {
			assignedVariant = 'control';
			experimentEnabled = false;
		}
	}

	function applyQuestionExperimentExposure(
		question: GeneratedQuestion,
		source: QuestionSource
	): void {
		const selectedClass = opts.getSelectedClass();
		const selectedUnit = opts.getSelectedUnit();
		const resolved = resolveDisplayedVariant({
			assigned: assignedVariant,
			experimentEnabled,
			questionHasHints: hasValidHints(question)
		});
		displayedVariant = resolved.displayed;
		multiAttemptState = createMultiAttemptState();

		capturePostHogEvent('practice_experiment_exposed', {
			assigned_variant: assignedVariant,
			displayed_variant: resolved.displayed,
			experiment_key: MULTI_ATTEMPT_EXPERIMENT_KEY,
			experiment_version: MULTI_ATTEMPT_EXPERIMENT_VERSION,
			question_source: source,
			fallback_reason: resolved.fallbackReason,
			ap_class: selectedClass,
			unit: selectedUnit,
			topic: question.topic
		});
	}

	function buildAnswerResult(selectedAnswer: string): AnswerResult | null {
		if (!currentQuestion?.correctAnswer) return null;

		return {
			questionId: currentQuestion.questionId?.trim() || undefined,
			questionNumber: effectiveQuestionNumber,
			selectedAnswer,
			correctAnswer: currentQuestion.correctAnswer,
			isCorrect: selectedAnswer === currentQuestion.correctAnswer,
			timeTakenMs: Date.now() - startedAtMs,
			displayedVariant,
			experimentKey: MULTI_ATTEMPT_EXPERIMENT_KEY,
			experimentVersion: MULTI_ATTEMPT_EXPERIMENT_VERSION
		};
	}

	async function loadQuestion(
		reason: 'skip' | 'not-learned' | 'next' | undefined = undefined
	): Promise<void> {
		if (isLoading) return;
		const selectedClass = opts.getSelectedClass();
		const selectedUnit = opts.getSelectedUnit();
		if (!selectedClass) {
			statusMessage = 'Please choose a class before requesting a question.';
			return;
		}

		isLoading = true;

		if (reason === 'skip') statusMessage = 'Skipped current question.';
		else if (reason === 'not-learned') statusMessage = "Marked as: I haven't learned this yet.";
		else statusMessage = 'Loading question...';

		const loadStartedAt = Date.now();
		try {
			const effectiveUnit = resolveEffectiveUnit(selectedClass, selectedUnit, opts.getUnitRange());
			const result = await requestMcqQuestion(selectedClass, effectiveUnit, [...seenQuestionIds]);
			const analytics = {
				apClass: selectedClass,
				unit: selectedUnit,
				source: result.source,
				latencyMs: result.latencyMs
			};
			captureQuestionRequestSucceeded(analytics);

			currentQuestion = { ...result.question, source: result.source };
			rememberSeenQuestion(result.question);
			questionCount += 1;
			statusMessage = 'Choose the best answer and then check your response.';
			resetInteractionState(true);
			applyQuestionExperimentExposure(result.question, result.source);
		} catch (error) {
			captureQuestionRequestFailed({
				apClass: selectedClass,
				unit: selectedUnit,
				failureKind: error instanceof QuestionRequestError ? error.failureKind : 'network',
				status: error instanceof QuestionRequestError ? error.status : null,
				latencyMs: Date.now() - loadStartedAt
			});
			statusMessage = error instanceof Error ? error.message : 'Could not load question.';
		} finally {
			isLoading = false;
		}
	}

	function handleOptionSelect(optionId: string): void {
		if (hasCheckedAnswer) return;
		opts.setSelectedOption(optionId);
	}

	function captureFirstAnswerAnalytics(
		result: AnswerResult & { selectedAnswer: string; isCorrect: boolean }
	): void {
		const selectedClass = opts.getSelectedClass();
		const selectedUnit = opts.getSelectedUnit();
		capturePostHogEvent('question_answered', {
			ap_class: selectedClass,
			unit: selectedUnit,
			question_id: result.questionId,
			topic: currentQuestion?.topic,
			source: currentQuestion?.source,
			is_correct: result.isCorrect,
			time_taken_ms: result.timeTakenMs
		});
		captureFirstAnswerSubmitted({
			apClass: selectedClass,
			unit: selectedUnit,
			isCorrect: result.isCorrect,
			timeTakenMs: result.timeTakenMs
		});
	}

	function captureQuestionCompletedAnalytics(
		result: AnswerResult,
		terminalOutcome: 'correct' | 'incorrect' | 'revealed' | 'max_attempts',
		resolvedCorrect: boolean,
		answerCount: number,
		hintsShown: number
	): void {
		capturePostHogEvent('practice_question_completed', {
			displayed_variant: result.displayedVariant ?? 'control',
			terminal_outcome: terminalOutcome,
			first_answer_correct: result.isCorrect,
			resolved_correct: resolvedCorrect,
			answer_count: answerCount,
			hints_shown: hintsShown,
			elapsed_ms: result.timeTakenMs,
			ap_class: opts.getSelectedClass(),
			unit: opts.getSelectedUnit(),
			topic: currentQuestion?.topic,
			source: currentQuestion?.source
		});
	}

	function finalizeTreatmentAttempt(): void {
		if (!currentQuestion?.correctAnswer || multiAttemptState.phase !== 'terminal') return;

		const firstAnswer = multiAttemptState.answers[0];

		const result: AnswerResult = {
			questionId: currentQuestion.questionId?.trim() || undefined,
			questionNumber: effectiveQuestionNumber,
			selectedAnswer: firstAnswer,
			correctAnswer: currentQuestion.correctAnswer,
			isCorrect: multiAttemptState.firstAnswerCorrect ?? undefined,
			timeTakenMs: Date.now() - startedAtMs,
			finalAnswer: multiAttemptState.answers[multiAttemptState.answers.length - 1],
			answerCount: multiAttemptState.answers.length,
			hintsShown: multiAttemptState.hintsShown,
			terminalOutcome: multiAttemptState.terminalOutcome ?? undefined,
			displayedVariant: 'multi_attempt_hints',
			experimentKey: MULTI_ATTEMPT_EXPERIMENT_KEY,
			experimentVersion: MULTI_ATTEMPT_EXPERIMENT_VERSION,
			answers: [...multiAttemptState.answers]
		};

		hasCheckedAnswer = true;
		checkedSelection = firstAnswer ?? null;
		answerResult = result;
		opts.onAnswered?.(result);

		captureQuestionCompletedAnalytics(
			result,
			multiAttemptState.terminalOutcome ?? 'revealed',
			multiAttemptState.resolvedCorrect ?? false,
			multiAttemptState.answers.length,
			multiAttemptState.hintsShown
		);

		if (opts.getAutoShowExplanation() && currentQuestion.explanation) {
			showExplanation = true;
		}
	}

	function handleRevealAnswer(): void {
		if (!isTreatmentActive || hasCheckedAnswer) return;
		multiAttemptState = reduceMultiAttempt(multiAttemptState, { type: 'reveal' });
		finalizeTreatmentAttempt();
	}

	function handleCheckAnswer(): void {
		const selectedOption = opts.getSelectedOption();
		if (!selectedOption) return;
		opts.onCheckAnswer?.(selectedOption);

		if (!isTreatmentActive) {
			const result = buildAnswerResult(selectedOption);
			if (!result || result.selectedAnswer === undefined || result.isCorrect === undefined) return;
			const completeResult = result as AnswerResult & {
				selectedAnswer: string;
				isCorrect: boolean;
			};

			hasCheckedAnswer = true;
			checkedSelection = completeResult.selectedAnswer;
			answerResult = completeResult;
			opts.onAnswered?.(completeResult);
			captureFirstAnswerAnalytics(completeResult);
			captureQuestionCompletedAnalytics(
				completeResult,
				completeResult.isCorrect ? 'correct' : 'incorrect',
				completeResult.isCorrect,
				1,
				0
			);

			if (opts.getAutoShowExplanation() && currentQuestion?.explanation) {
				showExplanation = true;
			}
			return;
		}

		const answer = normalizeAnswerLetter(selectedOption);
		const correctAnswer = normalizeAnswerLetter(currentQuestion?.correctAnswer);
		if (!answer || !correctAnswer) return;

		const isFirstSubmit = multiAttemptState.answers.length === 0;
		const prevHintsShown = multiAttemptState.hintsShown;

		multiAttemptState = reduceMultiAttempt(multiAttemptState, {
			type: 'submit',
			answer,
			correctAnswer
		});

		if (isFirstSubmit) {
			const firstResult = buildAnswerResult(answer);
			if (firstResult?.selectedAnswer !== undefined && firstResult.isCorrect !== undefined) {
				captureFirstAnswerAnalytics(
					firstResult as AnswerResult & { selectedAnswer: string; isCorrect: boolean }
				);
			}
		}

		if (multiAttemptState.hintsShown > prevHintsShown) {
			capturePostHogEvent('practice_hint_shown', {
				displayed_variant: 'multi_attempt_hints',
				hint_number: multiAttemptState.hintsShown,
				first_answer_correct: multiAttemptState.firstAnswerCorrect,
				ap_class: opts.getSelectedClass(),
				unit: opts.getSelectedUnit(),
				topic: currentQuestion?.topic,
				source: currentQuestion?.source
			});
		}

		if (multiAttemptState.phase === 'terminal') {
			finalizeTreatmentAttempt();
		} else {
			opts.setSelectedOption(null);
		}
	}

	async function handleNextQuestion(): Promise<void> {
		await loadQuestion('next');
	}

	async function handleSkipQuestion(): Promise<void> {
		opts.onSkip?.();
		capturePostHogEvent('question_skipped', {
			ap_class: opts.getSelectedClass(),
			unit: opts.getSelectedUnit(),
			question_id: currentQuestion?.questionId,
			topic: currentQuestion?.topic,
			source: currentQuestion?.source
		});
		await loadQuestion('skip');
	}

	async function handleNotLearnedQuestion(): Promise<void> {
		opts.onNotLearned?.();
		capturePostHogEvent('question_marked_not_learned', {
			ap_class: opts.getSelectedClass(),
			unit: opts.getSelectedUnit(),
			question_id: currentQuestion?.questionId,
			topic: currentQuestion?.topic,
			source: currentQuestion?.source
		});
		await loadQuestion('not-learned');
	}

	function submitQuestionFeedback(
		reason: 'answer_incorrect' | 'question_unclear' | 'explanation_unclear'
	): void {
		if (!currentQuestion?.questionId || questionFeedbackReason) return;

		questionFeedbackReason = reason;
		capturePostHogEvent('question_feedback_submitted', {
			reason,
			question_id: currentQuestion.questionId,
			ap_class: opts.getSelectedClass(),
			unit: opts.getSelectedUnit(),
			topic: currentQuestion.topic,
			source: currentQuestion.source,
			is_correct: answerResult?.isCorrect
		});
		void apiFetch('/api/question/feedback', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				questionId: currentQuestion.questionId,
				type: reason,
				apClass: opts.getSelectedClass(),
				unit: opts.getSelectedUnit()
			})
		}).catch(() => {
			// Analytics still captures the interaction; durable feedback requires a signed-in session.
		});
	}

	async function init(): Promise<void> {
		currentQuestion = null;
		questionCount = 0;
		resetInteractionState(true);
		statusMessage = 'Choose the best answer and then check your response.';

		await fetchPracticeExperiment();
		if (opts.getRequestVersion() > 0) {
			await loadQuestion();
		} else if (currentQuestion) {
			isLoading = false;
		}
	}

	return {
		get hasCheckedAnswer() {
			return hasCheckedAnswer;
		},
		get checkedSelection() {
			return checkedSelection;
		},
		get answerResult() {
			return answerResult;
		},
		get showExplanation() {
			return showExplanation;
		},
		set showExplanation(value: boolean) {
			showExplanation = value;
		},
		get startedAtMs() {
			return startedAtMs;
		},
		get isLoading() {
			return isLoading;
		},
		get questionCount() {
			return questionCount;
		},
		get statusMessage() {
			return statusMessage;
		},
		get currentQuestion() {
			return currentQuestion;
		},
		get seenQuestionIds() {
			return seenQuestionIds;
		},
		get assignedVariant() {
			return assignedVariant;
		},
		get experimentEnabled() {
			return experimentEnabled;
		},
		get displayedVariant() {
			return displayedVariant;
		},
		get multiAttemptState() {
			return multiAttemptState;
		},
		get questionFeedbackReason() {
			return questionFeedbackReason;
		},
		get effectiveQuestionNumber() {
			return effectiveQuestionNumber;
		},
		get isTreatmentActive() {
			return isTreatmentActive;
		},
		get lockedChoices() {
			return lockedChoices;
		},
		get activeHintText() {
			return activeHintText;
		},
		get feedbackMessage() {
			return feedbackMessage;
		},
		get showEmptyState() {
			return showEmptyState;
		},
		rememberSeenQuestion,
		resetInteractionState,
		fetchPracticeExperiment,
		applyQuestionExperimentExposure,
		buildAnswerResult,
		loadQuestion,
		handleOptionSelect,
		captureFirstAnswerAnalytics,
		captureQuestionCompletedAnalytics,
		finalizeTreatmentAttempt,
		handleRevealAnswer,
		handleCheckAnswer,
		handleNextQuestion,
		handleSkipQuestion,
		handleNotLearnedQuestion,
		submitQuestionFeedback,
		init
	};
}
