import { apiFetch } from '$lib/client/api.js';
import {
	captureFirstAnswerSubmitted,
	captureQuestionRequestFailed,
	captureQuestionRequestSucceeded,
	QuestionRequestError
} from '$lib/client/activation-analytics';
import { capturePostHogEvent } from '$lib/client/posthog-analytics';
import { resolveEffectiveUnit } from '$lib/catalog/ap-classes';
import {
	PoolWarmingError,
	requestMcqQuestion,
	requestMcqQuestionById
} from '$lib/question-bank/request.client';
import type {
	AddTextAnnotationInput,
	AnswerResult,
	GeneratedQuestion,
	OptionMarks,
	QuestionCoreOpts,
	QuestionFeedbackReason,
	QuestionLoadReason,
	TextAnnotation
} from '$lib/question-bank/mcq/types';

const MAX_SEEN_QUESTION_IDS = 100;
const MAX_POOL_WARMING_AUTO_RETRIES = 3;

function createAnnotationId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `ann-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function toggleId(ids: string[], id: string): string[] {
	return ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];
}

export function createQuestionCore(opts: QuestionCoreOpts) {
	let hasCheckedAnswer = $state(false);
	let checkedSelection = $state<string | null>(null);
	let answerResult = $state<AnswerResult | null>(null);
	let showExplanation = $state(false);
	let startedAtMs = $state(Date.now());
	let isLoading = $state(false);
	let questionCount = $state(0);
	let statusMessage = $state('');
	let questionLoadFailed = $state(false);
	let isPoolWarming = $state(false);
	let poolWarmingRetryAfterSeconds = $state(15);
	let poolWarmingAutoAttempts = $state(0);
	let currentQuestion = $state<GeneratedQuestion | null>(null);
	let seenQuestionIds = $state<string[]>([]);
	let questionFeedbackReason = $state<string | null>(null);
	let struckOptionIds = $state<string[]>([]);
	let highlightedOptionIds = $state<string[]>([]);
	let textAnnotations = $state<TextAnnotation[]>([]);
	let warmingRetryTimer: ReturnType<typeof setTimeout> | null = null;
	let consumedPresetQuestionId = $state(false);

	const effectiveQuestionNumber = $derived(opts.getQuestionNumber() || `${questionCount}`);
	const selectedOption = $derived(opts.getSelectedOption());
	const feedbackMessage = $derived.by(() => {
		if (!hasCheckedAnswer || !answerResult || !currentQuestion?.correctAnswer) {
			return statusMessage;
		}
		if (answerResult.isCorrect) {
			return 'Correct! Nice work.';
		}
		return `Incorrect. Correct answer: ${answerResult.correctAnswer}.`;
	});
	const showEmptyState = $derived(
		!isLoading &&
			!questionLoadFailed &&
			!isPoolWarming &&
			opts.getRequestVersion() === 0 &&
			!currentQuestion &&
			!opts.getQuizMode()
	);
	const showWarmingState = $derived(isPoolWarming);
	const showErrorState = $derived(!isLoading && questionLoadFailed && !isPoolWarming);
	const optionMarks = $derived<OptionMarks>({
		struckOptionIds: new Set(struckOptionIds),
		highlightedOptionIds: new Set(highlightedOptionIds)
	});

	function clearWarmingRetryTimer(): void {
		if (!warmingRetryTimer) return;
		clearTimeout(warmingRetryTimer);
		warmingRetryTimer = null;
	}

	function rememberSeenQuestion(question: GeneratedQuestion): void {
		const questionId = question.questionId?.trim() ?? '';
		if (!questionId || seenQuestionIds.includes(questionId)) return;
		seenQuestionIds = [...seenQuestionIds, questionId].slice(-MAX_SEEN_QUESTION_IDS);
	}

	function clearAnnotations(): void {
		struckOptionIds = [];
		highlightedOptionIds = [];
		textAnnotations = [];
	}

	function resetInteractionState(clearSelection = true): void {
		hasCheckedAnswer = false;
		checkedSelection = null;
		answerResult = null;
		showExplanation = false;
		questionFeedbackReason = null;
		startedAtMs = Date.now();
		clearAnnotations();
		if (clearSelection) opts.setSelectedOption(null);
	}

	function buildAnswerResult(selectedAnswer: string): AnswerResult | null {
		if (!currentQuestion?.correctAnswer) return null;

		return {
			questionId: currentQuestion.questionId?.trim() || undefined,
			questionNumber: effectiveQuestionNumber,
			selectedAnswer,
			correctAnswer: currentQuestion.correctAnswer,
			isCorrect: selectedAnswer === currentQuestion.correctAnswer,
			timeTakenMs: Date.now() - startedAtMs
		};
	}

	async function loadQuestion(
		reason: QuestionLoadReason | undefined = undefined,
		options: { isAutoWarmingRetry?: boolean } = {}
	): Promise<void> {
		if (isLoading) return;
		const selectedClass = opts.getSelectedClass();
		const selectedUnit = opts.getSelectedUnit();
		const presetQuestionId = consumedPresetQuestionId
			? ''
			: (opts.getPresetQuestionId()?.trim() ?? '');
		if (!selectedClass && !presetQuestionId) {
			statusMessage = 'Please choose a class before requesting a question.';
			return;
		}

		clearWarmingRetryTimer();
		isLoading = true;
		questionLoadFailed = false;
		if (!options.isAutoWarmingRetry) {
			isPoolWarming = false;
			poolWarmingAutoAttempts = 0;
		}

		if (reason === 'skip') statusMessage = 'Skipped current question.';
		else if (reason === 'not-learned') statusMessage = "Marked as: I haven't learned this yet.";
		else if (reason === 'retry' || options.isAutoWarmingRetry)
			statusMessage = 'Checking whether practice is ready…';
		else statusMessage = 'Loading question...';

		const loadStartedAt = Date.now();
		try {
			const effectiveUnit = resolveEffectiveUnit(selectedClass, selectedUnit, opts.getUnitRange());
			const result = presetQuestionId
				? await requestMcqQuestionById(presetQuestionId)
				: await requestMcqQuestion(selectedClass, effectiveUnit, [...seenQuestionIds]);
			if (presetQuestionId) consumedPresetQuestionId = true;
			captureQuestionRequestSucceeded({
				apClass: selectedClass,
				unit: selectedUnit,
				source: result.source,
				latencyMs: result.latencyMs
			});

			if (result.exclusionsReset) {
				seenQuestionIds = [];
			}
			currentQuestion = { ...result.question, source: result.source };
			rememberSeenQuestion(result.question);
			questionCount += 1;
			isPoolWarming = false;
			poolWarmingAutoAttempts = 0;
			statusMessage = 'Choose the best answer and then check your response.';
			resetInteractionState(true);
		} catch (error) {
			captureQuestionRequestFailed({
				apClass: selectedClass,
				unit: selectedUnit,
				failureKind: error instanceof QuestionRequestError ? error.failureKind : 'network',
				status: error instanceof QuestionRequestError ? error.status : null,
				latencyMs: Date.now() - loadStartedAt
			});

			if (error instanceof PoolWarmingError) {
				currentQuestion = null;
				questionLoadFailed = false;
				isPoolWarming = true;
				poolWarmingRetryAfterSeconds = error.retryAfterSeconds;
				statusMessage =
					error.message || 'This course unit is still warming up. Practice will be ready shortly.';

				if (poolWarmingAutoAttempts < MAX_POOL_WARMING_AUTO_RETRIES && opts.getMounted()) {
					poolWarmingAutoAttempts += 1;
					const delaySeconds = Math.max(1, error.retryAfterSeconds);
					warmingRetryTimer = setTimeout(() => {
						warmingRetryTimer = null;
						if (!opts.getMounted()) return;
						void loadQuestion('retry', { isAutoWarmingRetry: true });
					}, delaySeconds * 1000);
				}
			} else {
				isPoolWarming = false;
				questionLoadFailed = true;
				currentQuestion = null;
				statusMessage = error instanceof Error ? error.message : 'Could not load question.';
			}
		} finally {
			isLoading = false;
		}
	}

	async function retryWarmingLoad(): Promise<void> {
		poolWarmingAutoAttempts = 0;
		await loadQuestion('retry');
	}

	function selectOption(optionId: string | null): void {
		if (hasCheckedAnswer) return;
		if (optionId !== null && struckOptionIds.includes(optionId)) return;
		opts.setSelectedOption(optionId);
		opts.onOptionSelected?.(optionId);
	}

	function toggleOptionStrike(optionId: string): void {
		const nextStruck = toggleId(struckOptionIds, optionId);
		struckOptionIds = nextStruck;
		if (nextStruck.includes(optionId) && opts.getSelectedOption() === optionId) {
			opts.setSelectedOption(null);
		}
	}

	function toggleOptionHighlight(optionId: string): void {
		highlightedOptionIds = toggleId(highlightedOptionIds, optionId);
	}

	function addTextAnnotation(input: AddTextAnnotationInput): TextAnnotation | null {
		if (input.start < 0 || input.end <= input.start) return null;

		const annotation: TextAnnotation = {
			id: createAnnotationId(),
			target: input.target,
			start: input.start,
			end: input.end,
			style: input.style,
			color: input.color
		};
		textAnnotations = [...textAnnotations, annotation];
		return annotation;
	}

	function removeAnnotation(annotationId: string): void {
		textAnnotations = textAnnotations.filter((annotation) => annotation.id !== annotationId);
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
		terminalOutcome: 'correct' | 'incorrect'
	): void {
		capturePostHogEvent('practice_question_completed', {
			terminal_outcome: terminalOutcome,
			is_correct: result.isCorrect,
			elapsed_ms: result.timeTakenMs,
			ap_class: opts.getSelectedClass(),
			unit: opts.getSelectedUnit(),
			topic: currentQuestion?.topic,
			source: currentQuestion?.source
		});
	}

	function checkAnswer(): void {
		const currentSelection = opts.getSelectedOption();
		if (!currentSelection) return;
		opts.onCheckAnswer?.(currentSelection);

		const result = buildAnswerResult(currentSelection);
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
			completeResult.isCorrect ? 'correct' : 'incorrect'
		);

		if (opts.getAutoShowExplanation() && currentQuestion?.explanation) {
			showExplanation = true;
		}
	}

	async function next(): Promise<void> {
		if (opts.getQuizMode()) {
			opts.onQuizNext?.();
			return;
		}
		await loadQuestion('next');
	}

	async function skip(): Promise<void> {
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

	async function notLearned(): Promise<void> {
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

	function setShowExplanation(value: boolean): void {
		showExplanation = value;
	}

	function submitQuestionFeedback(reason: QuestionFeedbackReason): void {
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
		clearWarmingRetryTimer();
		const quizQuestion = opts.getQuizMode() ? (opts.getQuizQuestion() ?? null) : null;
		const quizAnswer = opts.getQuizMode() ? (opts.getQuizAnswer() ?? null) : null;
		currentQuestion = quizQuestion;
		questionCount = 0;
		isPoolWarming = false;
		poolWarmingAutoAttempts = 0;
		questionLoadFailed = false;
		resetInteractionState(!quizQuestion);
		statusMessage = 'Choose the best answer and then check your response.';

		if (quizQuestion) {
			questionCount = 1;
			statusMessage = 'Select an answer, then submit it when you are ready.';
			if (quizAnswer) {
				hasCheckedAnswer = true;
				checkedSelection = quizAnswer.selectedAnswer ?? null;
				answerResult = quizAnswer;
				opts.setSelectedOption(quizAnswer.selectedAnswer ?? null);
			}
		}
	}

	function destroy(): void {
		clearWarmingRetryTimer();
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
		get selectedOption() {
			return selectedOption;
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
		get questionFeedbackReason() {
			return questionFeedbackReason;
		},
		get effectiveQuestionNumber() {
			return effectiveQuestionNumber;
		},
		get feedbackMessage() {
			return feedbackMessage;
		},
		get showEmptyState() {
			return showEmptyState;
		},
		get showWarmingState() {
			return showWarmingState;
		},
		get showErrorState() {
			return showErrorState;
		},
		get isPoolWarming() {
			return isPoolWarming;
		},
		get poolWarmingRetryAfterSeconds() {
			return poolWarmingRetryAfterSeconds;
		},
		get optionMarks() {
			return optionMarks;
		},
		get textAnnotations() {
			return textAnnotations;
		},
		rememberSeenQuestion,
		resetInteractionState,
		buildAnswerResult,
		loadQuestion,
		retryWarmingLoad,
		selectOption,
		checkAnswer,
		next,
		skip,
		notLearned,
		setShowExplanation,
		submitQuestionFeedback,
		toggleOptionStrike,
		toggleOptionHighlight,
		addTextAnnotation,
		removeAnnotation,
		clearAnnotations,
		init,
		destroy
	};
}
