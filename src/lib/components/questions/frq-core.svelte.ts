import { apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/api.js';
import { QuestionRequestError } from '$lib/client/activation-analytics';
import { capturePostHogEvent } from '$lib/client/posthog-analytics.js';
import { resolveEffectiveUnit } from '$lib/catalog/ap-classes';
import { FRQ_ALL_UNITS, frqPracticeFor } from '$lib/question-bank/frq/practice';
import {
	parseFrqLatestDraft,
	parseFrqQuestionDraft,
	serializeFrqLatestDraft,
	serializeFrqQuestionDraft
} from '$lib/question-bank/frq/draft.client.js';
import {
	frqResponseIds,
	type FrqAttemptView,
	type FrqGrade,
	type PublicFrqQuestion
} from '$lib/question-bank/frq/types';
import {
	PoolWarmingError,
	requestFrqQuestion,
	requestFrqQuestionById
} from '$lib/question-bank/request.client';

const MAX_SEEN_QUESTION_IDS = 100;
const MAX_POOL_WARMING_AUTO_RETRIES = 3;
const TIMER_TICK_MS = 250;

export type FrqCoreOpts = {
	getSelectedClass: () => string;
	getSelectedUnit: () => string;
	getSelectedFormat: () => string;
	getRequestVersion: () => number;
	getPresetQuestionId: () => string;
	getMounted: () => boolean;
	getOnGraded?: () => ((attempt: FrqAttemptView) => void) | undefined;
	getOnSkip?: () => (() => void) | undefined;
};

type GradeResponse = { attempt?: FrqAttemptView; error?: string };

export function createFrqCore(opts: FrqCoreOpts) {
	let question = $state<PublicFrqQuestion | null>(null);
	let responses = $state<Record<string, string>>({});
	let grade = $state<FrqGrade | null>(null);
	let isLoading = $state(false);
	let isGrading = $state(false);
	let errorMessage = $state('');
	let isPoolWarming = $state(false);
	let poolWarmingRetryAfterSeconds = $state(15);
	let poolWarmingAutoAttempts = $state(0);
	let statusMessage = $state('Write your responses, then submit for rubric feedback.');
	let startedAt = $state(0);
	let timerNowMs = $state(0);
	let attemptId = $state('');
	let disagreementReported = $state(false);
	let seenQuestionIds = $state<string[]>([]);
	let consumedPresetQuestionId = $state('');
	let warmingRetryTimer: ReturnType<typeof setTimeout> | null = null;
	let timerInterval: ReturnType<typeof setInterval> | null = null;
	let loadGeneration = 0;
	let lastLoadedRequestVersion = 0;

	const selectedClass = $derived(opts.getSelectedClass());
	const selectedUnit = $derived(opts.getSelectedUnit());
	const selectedFormat = $derived(opts.getSelectedFormat());
	const draftKey = $derived(question?.questionId ? `frq-draft:${question.questionId}` : '');
	const draftScopeKey = $derived(
		selectedClass
			? `frq-latest-draft:${selectedClass}:${
					frqPracticeFor(selectedClass)?.control === 'task'
						? selectedFormat || 'task'
						: selectedUnit || 'all-units'
				}`
			: ''
	);
	const hasResponse = $derived(
		Object.values(responses).some((response) => response.trim().length > 0)
	);
	const questionLoadFailed = $derived(Boolean(errorMessage) && !isPoolWarming && !isLoading);
	const showEmptyState = $derived(
		!isLoading &&
			!questionLoadFailed &&
			!isPoolWarming &&
			opts.getRequestVersion() === 0 &&
			!question
	);
	const elapsedMs = $derived(startedAt > 0 ? Math.max(0, timerNowMs - startedAt) : 0);

	function clearWarmingRetryTimer(): void {
		if (!warmingRetryTimer) return;
		clearTimeout(warmingRetryTimer);
		warmingRetryTimer = null;
	}

	function stopTimer(): void {
		if (!timerInterval) return;
		clearInterval(timerInterval);
		timerInterval = null;
	}

	function startTimer(): void {
		stopTimer();
		const now = Date.now();
		startedAt = now;
		timerNowMs = now;
		timerInterval = setInterval(() => {
			timerNowMs = Date.now();
		}, TIMER_TICK_MS);
	}

	function rememberQuestion(questionId: string | undefined): void {
		if (!questionId || seenQuestionIds.includes(questionId)) return;
		seenQuestionIds = [...seenQuestionIds, questionId].slice(-MAX_SEEN_QUESTION_IDS);
	}

	function emptyResponses(nextQuestion: PublicFrqQuestion): Record<string, string> {
		return Object.fromEntries(frqResponseIds(nextQuestion).map((responseId) => [responseId, '']));
	}

	function restoreDraft(nextQuestion: PublicFrqQuestion): Record<string, string> {
		if (typeof sessionStorage === 'undefined') return emptyResponses(nextQuestion);
		return (
			parseFrqQuestionDraft(
				sessionStorage.getItem(`frq-draft:${nextQuestion.questionId}`),
				nextQuestion
			) ?? emptyResponses(nextQuestion)
		);
	}

	function restoreLatestDraft(): boolean {
		if (!draftScopeKey || typeof sessionStorage === 'undefined') return false;
		const saved = parseFrqLatestDraft(sessionStorage.getItem(draftScopeKey), {
			apClass: selectedClass,
			unit: selectedUnit || undefined
		});
		if (!saved) return false;
		question = saved.question;
		responses = saved.responses;
		startTimer();
		statusMessage = 'Draft restored. Continue writing, then submit for rubric feedback.';
		return true;
	}

	function saveDraft(): void {
		if (!draftKey || typeof sessionStorage === 'undefined' || grade || !question) return;
		sessionStorage.setItem(draftKey, serializeFrqQuestionDraft(question, responses));
		if (draftScopeKey) {
			sessionStorage.setItem(draftScopeKey, serializeFrqLatestDraft(question, responses));
		}
	}

	function clearDraft(): void {
		if (typeof sessionStorage === 'undefined') return;
		if (draftKey) sessionStorage.removeItem(draftKey);
		if (draftScopeKey) {
			const saved = sessionStorage.getItem(draftScopeKey);
			const latest = parseFrqLatestDraft(saved, {
				apClass: selectedClass,
				unit: selectedUnit || undefined
			});
			if (!latest || latest.question.questionId === question?.questionId) {
				sessionStorage.removeItem(draftScopeKey);
			}
		}
	}

	function updateResponse(sectionId: string, value: string): void {
		responses[sectionId] = value;
		responses = { ...responses };
		saveDraft();
	}

	async function loadQuestion(options: { isAutoWarmingRetry?: boolean } = {}): Promise<void> {
		if (!selectedClass || isLoading) return;
		clearWarmingRetryTimer();
		loadGeneration += 1;
		isLoading = true;
		isGrading = false;
		grade = null;
		attemptId = '';
		disagreementReported = false;
		errorMessage = '';
		stopTimer();
		if (!options.isAutoWarmingRetry) {
			isPoolWarming = false;
			poolWarmingAutoAttempts = 0;
		}
		statusMessage = options.isAutoWarmingRetry
			? 'Checking whether written-response practice is ready…'
			: 'Loading a written-response task…';
		try {
			const practice = frqPracticeFor(selectedClass);
			const effectiveUnit =
				practice?.control === 'task'
					? FRQ_ALL_UNITS
					: resolveEffectiveUnit(selectedClass, selectedUnit);
			const requestedPresetId = opts.getPresetQuestionId().trim();
			const presetId =
				requestedPresetId && consumedPresetQuestionId !== requestedPresetId
					? requestedPresetId
					: '';
			const result = presetId
				? await requestFrqQuestionById(presetId)
				: await requestFrqQuestion(
						selectedClass,
						effectiveUnit,
						[...seenQuestionIds],
						practice?.control === 'task' ? selectedFormat : undefined
					);
			if (presetId) consumedPresetQuestionId = presetId;
			if (result.exclusionsReset) seenQuestionIds = [];
			question = result.question;
			responses = restoreDraft(result.question);
			startTimer();
			isPoolWarming = false;
			poolWarmingAutoAttempts = 0;
			statusMessage = 'Write your responses, then submit for rubric feedback.';
			rememberQuestion(result.question.questionId);
			capturePostHogEvent('frq_question_loaded', {
				ap_class: selectedClass,
				unit: selectedUnit,
				question_id: result.question.questionId
			});
		} catch (error) {
			if (error instanceof PoolWarmingError) {
				question = null;
				errorMessage = '';
				isPoolWarming = true;
				poolWarmingRetryAfterSeconds = error.retryAfterSeconds;
				statusMessage =
					error.message || 'This course unit is still warming up. Practice will be ready shortly.';
				if (poolWarmingAutoAttempts < MAX_POOL_WARMING_AUTO_RETRIES && opts.getMounted()) {
					poolWarmingAutoAttempts += 1;
					const delaySeconds = Math.max(1, error.retryAfterSeconds);
					const generation = loadGeneration;
					warmingRetryTimer = setTimeout(() => {
						warmingRetryTimer = null;
						if (generation !== loadGeneration) return;
						void loadQuestion({ isAutoWarmingRetry: true });
					}, delaySeconds * 1000);
				}
			} else {
				isPoolWarming = false;
				errorMessage =
					error instanceof QuestionRequestError
						? error.message
						: error instanceof Error
							? error.message
							: 'Could not load written-response practice.';
				statusMessage = '';
			}
		} finally {
			isLoading = false;
		}
	}

	async function retryWarmingLoad(): Promise<void> {
		poolWarmingAutoAttempts = 0;
		await loadQuestion();
	}

	async function submit(): Promise<void> {
		if (!question || !hasResponse || isGrading || grade) return;
		isGrading = true;
		errorMessage = '';
		statusMessage = 'Grading your response against the course rubric…';
		try {
			const response = await apiFetch('/api/question/frq/grade', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					questionId: question.questionId,
					submissionId: crypto.randomUUID(),
					responses,
					timeTakenMs: Date.now() - startedAt
				})
			});
			const payload = await readJsonOrNull<GradeResponse>(response);
			if (!response.ok || !payload?.attempt) {
				throw new Error(getResponseMessage(payload, 'Could not grade your response.'));
			}
			grade = payload.attempt.grade;
			attemptId = payload.attempt.id;
			timerNowMs = Date.now();
			stopTimer();
			statusMessage = `Score: ${grade.pointsEarned}/${grade.pointsAvailable} points (${grade.percentage}%).`;
			clearDraft();
			opts.getOnGraded?.()?.(payload.attempt);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Could not grade your response.';
			statusMessage = '';
		} finally {
			isGrading = false;
		}
	}

	async function nextQuestion(): Promise<void> {
		if (!grade) clearDraft();
		question = null;
		responses = {};
		grade = null;
		attemptId = '';
		disagreementReported = false;
		await loadQuestion();
	}

	function skip(): void {
		const onSkip = opts.getOnSkip?.();
		if (onSkip) {
			onSkip();
			return;
		}
		void nextQuestion();
	}

	function reportDisagreement(): void {
		if (disagreementReported || !question || !grade || !attemptId) return;
		disagreementReported = true;
		capturePostHogEvent('frq_grade_disagreement_reported', {
			question_id: question.questionId,
			attempt_id: attemptId,
			ap_class: selectedClass,
			unit: selectedUnit,
			points_earned: grade.pointsEarned,
			points_available: grade.pointsAvailable
		});
	}

	function syncRequestVersion(): void {
		const version = opts.getRequestVersion();
		if (version === 0 || version === lastLoadedRequestVersion) return;
		lastLoadedRequestVersion = version;
		if (!restoreLatestDraft()) void loadQuestion();
	}

	function destroy(): void {
		loadGeneration += 1;
		clearWarmingRetryTimer();
		stopTimer();
	}

	return {
		get question() {
			return question;
		},
		get responses() {
			return responses;
		},
		get grade() {
			return grade;
		},
		get isLoading() {
			return isLoading;
		},
		get isGrading() {
			return isGrading;
		},
		get errorMessage() {
			return errorMessage;
		},
		get isPoolWarming() {
			return isPoolWarming;
		},
		get poolWarmingRetryAfterSeconds() {
			return poolWarmingRetryAfterSeconds;
		},
		get statusMessage() {
			return statusMessage;
		},
		get attemptId() {
			return attemptId;
		},
		get disagreementReported() {
			return disagreementReported;
		},
		get hasResponse() {
			return hasResponse;
		},
		get showEmptyState() {
			return showEmptyState;
		},
		get questionLoadFailed() {
			return questionLoadFailed;
		},
		get elapsedMs() {
			return elapsedMs;
		},
		updateResponse,
		loadQuestion,
		retryWarmingLoad,
		submit,
		nextQuestion,
		skip,
		reportDisagreement,
		syncRequestVersion,
		destroy
	};
}
