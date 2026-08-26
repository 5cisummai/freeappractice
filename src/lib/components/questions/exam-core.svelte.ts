import type {
	AnswerResult,
	ExamCoreOpts,
	ExamKind,
	ExamMeta,
	ExamNavItem,
	ExamScore,
	ExamSnapshot,
	ExamStatus,
	GeneratedQuestion,
	StartExamInput
} from '$lib/question-bank/mcq/types';

const DEFAULT_MAX_QUESTION_COUNT = 50;
const DEFAULT_MAX_CONCURRENT_FILL = 4;
const DEFAULT_MAX_DUPLICATE_RETRIES = 3;
const TIMER_TICK_MS = 250;

function createExamId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `exam-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function questionId(question: GeneratedQuestion): string | undefined {
	const id = question.questionId?.trim();
	return id || undefined;
}

function normalizeCount(value: number, maxCount: number): number {
	if (!Number.isFinite(value)) return 10;
	return Math.min(maxCount, Math.max(1, Math.floor(value)));
}

function toggleIndex(indexes: number[], index: number): number[] {
	return indexes.includes(index)
		? indexes.filter((value) => value !== index)
		: [...indexes, index].sort((a, b) => a - b);
}

export function createExamCore(opts: ExamCoreOpts = {}) {
	const maxQuestionCount = opts.maxQuestionCount ?? DEFAULT_MAX_QUESTION_COUNT;
	const maxConcurrentFill = opts.maxConcurrentFill ?? DEFAULT_MAX_CONCURRENT_FILL;
	const maxDuplicateRetries = opts.maxDuplicateRetries ?? DEFAULT_MAX_DUPLICATE_RETRIES;
	const getMounted = opts.getMounted ?? (() => true);

	let status = $state<ExamStatus>('idle');
	let examId = $state('');
	let examKind = $state<ExamKind>('quiz');
	let examMeta = $state<ExamMeta>({});
	let questions = $state<Array<GeneratedQuestion | null>>([]);
	let draftSelections = $state<Array<string | null>>([]);
	let answers = $state<Array<AnswerResult | null>>([]);
	let flaggedIndexes = $state<number[]>([]);
	let failedIndexes = $state<number[]>([]);
	let currentIndex = $state(0);
	let requestedCount = $state(0);
	let loadingCount = $state(0);
	let errorMessage = $state('');
	let startedAtMs = $state(0);
	let startedAtIso = $state('');
	let completedAtIso = $state('');
	let timeLimitMs = $state<number | null>(null);
	let isPaused = $state(false);
	let pausedAtMs = $state<number | null>(null);
	let accumulatedPauseMs = $state(0);
	let timerNowMs = $state(Date.now());
	let runToken = 0;
	let timerInterval: ReturnType<typeof setInterval> | null = null;

	const loadedCount = $derived(questions.filter(Boolean).length);
	const currentQuestion = $derived(questions[currentIndex] ?? null);
	const currentDraft = $derived(draftSelections[currentIndex] ?? null);
	const currentAnswer = $derived(answers[currentIndex] ?? null);
	const isLastQuestion = $derived(currentIndex === requestedCount - 1);
	const nextQuestionReady = $derived(isLastQuestion || Boolean(questions[currentIndex + 1]));
	const answeredQuestionCount = $derived(draftSelections.filter(Boolean).length);
	const canFinish = $derived(
		loadingCount === 0 && failedIndexes.length === 0 && loadedCount === requestedCount
	);
	const canSubmit = $derived(canFinish && (status === 'active' || status === 'review'));
	const flaggedCount = $derived(flaggedIndexes.length);
	const correctCount = $derived(answers.filter((answer) => answer?.isCorrect === true).length);
	const incorrectCount = $derived(answers.filter((answer) => answer?.isCorrect === false).length);
	const unansweredCount = $derived(Math.max(requestedCount - correctCount - incorrectCount, 0));
	const scorePercent = $derived(
		requestedCount > 0 ? Math.round((correctCount / requestedCount) * 100) : 0
	);
	const elapsedMs = $derived.by(() => {
		if (!startedAtMs) return 0;
		const pauseMs =
			accumulatedPauseMs + (isPaused && pausedAtMs !== null ? timerNowMs - pausedAtMs : 0);
		return Math.max(0, timerNowMs - startedAtMs - pauseMs);
	});
	const remainingMs = $derived(timeLimitMs === null ? null : Math.max(0, timeLimitMs - elapsedMs));
	const isExpired = $derived(timeLimitMs !== null && remainingMs === 0);
	const navItems = $derived.by((): ExamNavItem[] =>
		Array.from({ length: requestedCount }, (_, index) => ({
			index,
			loaded: Boolean(questions[index]),
			answered: Boolean(draftSelections[index]),
			flagged: flaggedIndexes.includes(index),
			failed: failedIndexes.includes(index)
		}))
	);
	const flaggedNavItems = $derived(navItems.filter((item) => item.flagged));
	const unansweredNavItems = $derived(navItems.filter((item) => item.loaded && !item.answered));
	const score = $derived<ExamScore>({
		correct: correctCount,
		incorrect: incorrectCount,
		unanswered: unansweredCount,
		percent: scorePercent
	});

	function isCurrentRun(token: number): boolean {
		return token === runToken;
	}

	function stopTimer(): void {
		if (!timerInterval) return;
		clearInterval(timerInterval);
		timerInterval = null;
	}

	function startTimer(): void {
		stopTimer();
		timerInterval = setInterval(() => {
			timerNowMs = Date.now();
			if (
				timeLimitMs !== null &&
				!isPaused &&
				startedAtMs > 0 &&
				elapsedMs >= timeLimitMs &&
				(status === 'active' || status === 'review')
			) {
				void submit();
			}
		}, TIMER_TICK_MS);
	}

	function resetRunState(): void {
		runToken += 1;
		stopTimer();
		status = 'idle';
		examId = '';
		examKind = 'quiz';
		examMeta = {};
		questions = [];
		draftSelections = [];
		answers = [];
		flaggedIndexes = [];
		failedIndexes = [];
		currentIndex = 0;
		requestedCount = 0;
		loadingCount = 0;
		errorMessage = '';
		startedAtMs = 0;
		startedAtIso = '';
		completedAtIso = '';
		timeLimitMs = null;
		isPaused = false;
		pausedAtMs = null;
		accumulatedPauseMs = 0;
		timerNowMs = Date.now();
	}

	function initializeSlots(count: number): void {
		questions = Array.from({ length: count }, () => null);
		draftSelections = Array.from({ length: count }, () => null);
		answers = Array.from({ length: count }, () => null);
		flaggedIndexes = [];
		failedIndexes = [];
		currentIndex = 0;
		requestedCount = count;
	}

	function beginTiming(limitMs: number | null | undefined): void {
		const now = Date.now();
		startedAtMs = now;
		startedAtIso = new Date(now).toISOString();
		completedAtIso = '';
		timeLimitMs = limitMs ?? null;
		isPaused = false;
		pausedAtMs = null;
		accumulatedPauseMs = 0;
		timerNowMs = now;
		startTimer();
	}

	async function loadQuestionViaLoader(seenIds: string[]): Promise<GeneratedQuestion> {
		if (!opts.loadQuestion) {
			throw new Error('No question loader configured.');
		}
		return opts.loadQuestion(seenIds);
	}

	async function fillIndexes(
		token: number,
		indexes: number[],
		seenQuestionIds: string[]
	): Promise<void> {
		let nextWorkerIndex = 0;
		const seenIds = [...seenQuestionIds];

		async function fillNextIndex(): Promise<void> {
			while (isCurrentRun(token)) {
				const index = indexes[nextWorkerIndex++];
				if (index === undefined) return;

				let question: GeneratedQuestion | null = null;
				let lastError: unknown = null;

				for (let attempt = 0; attempt <= maxDuplicateRetries; attempt += 1) {
					try {
						const candidate = await loadQuestionViaLoader([...seenIds]);
						const candidateId = questionId(candidate);
						if (candidateId && seenIds.includes(candidateId) && attempt < maxDuplicateRetries) {
							continue;
						}

						question = candidate;
						if (candidateId) {
							seenIds.push(candidateId);
							seenQuestionIds.push(candidateId);
						}
						break;
					} catch (error) {
						lastError = error;
						break;
					}
				}

				if (!isCurrentRun(token)) return;

				if (question) {
					questions[index] = question;
				} else {
					failedIndexes = [...failedIndexes, index];
					if (lastError instanceof Error) errorMessage = lastError.message;
				}
				loadingCount = Math.max(0, loadingCount - 1);
			}
		}

		const workerCount = Math.min(maxConcurrentFill, indexes.length);
		await Promise.all(Array.from({ length: workerCount }, () => fillNextIndex()));
	}

	function buildFinalAnswers(): Array<AnswerResult | null> {
		return questions.map((question, index) => {
			const selectedAnswer = draftSelections[index];
			if (!question || !selectedAnswer || !question.correctAnswer) return null;
			const recorded = answers[index];
			return {
				questionId: question.questionId?.trim() || undefined,
				questionNumber: String(index + 1),
				selectedAnswer,
				correctAnswer: question.correctAnswer,
				isCorrect: selectedAnswer === question.correctAnswer,
				timeTakenMs: recorded?.timeTakenMs ?? 0
			};
		});
	}

	function buildSnapshot(finalAnswers: Array<AnswerResult | null>): ExamSnapshot {
		const completedAt = completedAtIso || new Date().toISOString();
		const items = questions.map((question, position) => ({
			position,
			questionId: question?.questionId?.trim() ?? '',
			selectedAnswer: finalAnswers[position]?.selectedAnswer ?? draftSelections[position] ?? null,
			timeTakenMs: finalAnswers[position]?.timeTakenMs ?? answers[position]?.timeTakenMs ?? null,
			flagged: flaggedIndexes.includes(position),
			isCorrect: finalAnswers[position]?.isCorrect ?? null
		}));
		const correct = finalAnswers.filter((answer) => answer?.isCorrect === true).length;
		const incorrect = finalAnswers.filter((answer) => answer?.isCorrect === false).length;
		const unanswered = Math.max(requestedCount - correct - incorrect, 0);

		return {
			examId,
			kind: examKind,
			startedAt: startedAtIso,
			completedAt,
			elapsedMs,
			timeLimitMs,
			meta: examMeta,
			items,
			score: {
				correct,
				incorrect,
				unanswered,
				percent: requestedCount > 0 ? Math.round((correct / requestedCount) * 100) : 0
			}
		};
	}

	async function start(input: StartExamInput): Promise<void> {
		const token = ++runToken;
		stopTimer();

		examKind = input.meta?.kind ?? 'quiz';
		examMeta = input.meta ?? {};
		errorMessage = '';
		examId = createExamId();

		if (input.questions?.length) {
			const fixedQuestions = input.questions.map((question) => ({ ...question }));
			initializeSlots(fixedQuestions.length);
			questions = fixedQuestions;
			loadingCount = 0;
			status = 'active';
			beginTiming(input.timeLimitMs);
			return;
		}

		if (!opts.loadQuestion) {
			status = 'error';
			errorMessage = 'No question loader configured.';
			return;
		}

		const targetCount = normalizeCount(input.count, maxQuestionCount);
		status = 'loading';
		initializeSlots(targetCount);
		loadingCount = targetCount;

		try {
			const firstQuestion = await loadQuestionViaLoader([]);
			if (!isCurrentRun(token) || !getMounted()) return;

			questions[0] = firstQuestion;
			loadingCount = Math.max(0, targetCount - 1);
			status = 'active';
			beginTiming(input.timeLimitMs);

			if (targetCount > 1) {
				const seenQuestionIds: string[] = [];
				const firstId = questionId(firstQuestion);
				if (firstId) seenQuestionIds.push(firstId);
				void fillIndexes(
					token,
					Array.from({ length: targetCount - 1 }, (_, index) => index + 1),
					seenQuestionIds
				);
			}
		} catch (error) {
			if (!isCurrentRun(token)) return;
			status = 'error';
			loadingCount = 0;
			errorMessage = error instanceof Error ? error.message : 'Could not start this exam.';
		}
	}

	async function retryFailed(): Promise<void> {
		if (!failedIndexes.length || status === 'loading' || !opts.loadQuestion) return;

		const token = ++runToken;
		const retryIndexes = [...failedIndexes];
		failedIndexes = [];
		loadingCount = retryIndexes.length;
		errorMessage = '';

		const seenQuestionIds = questions.flatMap((question) => {
			const id = question ? questionId(question) : undefined;
			return id ? [id] : [];
		});
		await fillIndexes(token, retryIndexes, seenQuestionIds);
	}

	function goTo(index: number): void {
		if (status !== 'active' && status !== 'review') return;
		if (!questions[index] || index === currentIndex) return;
		currentIndex = index;
	}

	function next(): void {
		if (status !== 'active') return;
		if (!nextQuestionReady) return;
		if (isLastQuestion) {
			if (!canFinish) return;
			enterReview();
			return;
		}
		currentIndex += 1;
	}

	function prev(): void {
		if (status !== 'active' && status !== 'review') return;
		if (currentIndex <= 0) return;
		currentIndex -= 1;
	}

	function enterReview(): void {
		if (!canFinish || status !== 'active') return;
		status = 'review';
	}

	function exitReviewTo(index: number): void {
		if (!questions[index]) return;
		currentIndex = index;
		status = 'active';
	}

	function setDraft(index: number, optionId: string | null): void {
		if (status !== 'active' && status !== 'review') return;
		if (index < 0 || index >= draftSelections.length) return;
		draftSelections[index] = optionId;
	}

	function setDraftCurrent(optionId: string | null): void {
		setDraft(currentIndex, optionId);
	}

	function recordAnswer(index: number, result: AnswerResult): void {
		if (index < 0 || index >= answers.length) return;
		answers[index] = result;
		if (result.selectedAnswer) draftSelections[index] = result.selectedAnswer;
	}

	function toggleFlag(index = currentIndex): void {
		if (index < 0 || index >= requestedCount) return;
		flaggedIndexes = toggleIndex(flaggedIndexes, index);
	}

	function clearFlags(): void {
		flaggedIndexes = [];
	}

	function pause(): void {
		if (isPaused || status === 'idle' || status === 'complete' || status === 'error') return;
		isPaused = true;
		pausedAtMs = Date.now();
		timerNowMs = pausedAtMs;
	}

	function resume(): void {
		if (!isPaused || pausedAtMs === null) return;
		accumulatedPauseMs += Date.now() - pausedAtMs;
		pausedAtMs = null;
		isPaused = false;
		timerNowMs = Date.now();
	}

	async function submit(): Promise<void> {
		if (!canSubmit || status === 'complete') return;

		const finalAnswers = buildFinalAnswers();
		answers = finalAnswers;
		completedAtIso = new Date().toISOString();
		timerNowMs = Date.now();
		status = 'complete';
		stopTimer();

		const snapshot = buildSnapshot(finalAnswers);
		await opts.onComplete?.(snapshot);
	}

	function destroy(): void {
		runToken += 1;
		stopTimer();
	}

	return {
		get status() {
			return status;
		},
		get examId() {
			return examId;
		},
		get examKind() {
			return examKind;
		},
		get examMeta() {
			return examMeta;
		},
		get questions() {
			return questions;
		},
		get draftSelections() {
			return draftSelections;
		},
		get answers() {
			return answers;
		},
		get flaggedIndexes() {
			return flaggedIndexes;
		},
		get failedIndexes() {
			return failedIndexes;
		},
		get currentIndex() {
			return currentIndex;
		},
		get requestedCount() {
			return requestedCount;
		},
		get loadingCount() {
			return loadingCount;
		},
		get errorMessage() {
			return errorMessage;
		},
		get startedAtIso() {
			return startedAtIso;
		},
		get completedAtIso() {
			return completedAtIso;
		},
		get timeLimitMs() {
			return timeLimitMs;
		},
		get loadedCount() {
			return loadedCount;
		},
		get currentQuestion() {
			return currentQuestion;
		},
		get currentDraft() {
			return currentDraft;
		},
		get currentAnswer() {
			return currentAnswer;
		},
		get isLastQuestion() {
			return isLastQuestion;
		},
		get nextQuestionReady() {
			return nextQuestionReady;
		},
		get answeredQuestionCount() {
			return answeredQuestionCount;
		},
		get canFinish() {
			return canFinish;
		},
		get canSubmit() {
			return canSubmit;
		},
		get flaggedCount() {
			return flaggedCount;
		},
		get correctCount() {
			return correctCount;
		},
		get incorrectCount() {
			return incorrectCount;
		},
		get unansweredCount() {
			return unansweredCount;
		},
		get scorePercent() {
			return scorePercent;
		},
		get score() {
			return score;
		},
		get navItems() {
			return navItems;
		},
		get flaggedNavItems() {
			return flaggedNavItems;
		},
		get unansweredNavItems() {
			return unansweredNavItems;
		},
		get elapsedMs() {
			return elapsedMs;
		},
		get remainingMs() {
			return remainingMs;
		},
		get isExpired() {
			return isExpired;
		},
		get isPaused() {
			return isPaused;
		},
		start,
		retryFailed,
		goTo,
		next,
		prev,
		enterReview,
		exitReviewTo,
		setDraft,
		setDraftCurrent,
		recordAnswer,
		toggleFlag,
		clearFlags,
		pause,
		resume,
		submit,
		destroy,
		resetRunState
	};
}
