<script lang="ts">
	import { untrack } from 'svelte';
	import Loader2Icon from '@tabler/icons-svelte/icons/loader-2';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import QuestionCard from '#lib/components/questions/question-card.svelte';
	import FrqSession from '#lib/components/practice/frq-session.svelte';
	import { unlimitedQuestionCardModel } from '#lib/question-bank/question-card-model.js';
	import type { AnswerResult } from '#lib/question-bank/mcq/types.js';
	import type { FrqAttemptView } from '#lib/question-bank/frq/types.js';
	import { fetchCoachPracticeQuestion } from '#lib/agent/tools/practice.client.js';
	import {
		buildCoachPracticeQuestionToolOutput,
		coachPracticeQuestionRequestKey,
		COACH_PRACTICE_QUESTION_MAX_AUTO_RETRIES,
		getCoachPracticeQuestionRetryDelayMs,
		getCoachPracticeQuestionToolInput,
		type CoachPracticeQuestionOutput,
		type CoachPracticeQuestionToolInput,
		type CoachPracticeQuestionToolOutput
	} from '#lib/agent/tools/practice.js';

	let {
		input,
		onResolve
	}: {
		input: unknown;
		onResolve: (output: CoachPracticeQuestionToolOutput) => Promise<boolean>;
	} = $props();

	const toolInput = $derived(getCoachPracticeQuestionToolInput(input));
	const requestKey = $derived(coachPracticeQuestionRequestKey(toolInput));
	let question = $state<CoachPracticeQuestionOutput | null>(null);
	let loadError = $state('');
	let resolved = $state(false);
	let requestVersion = $state(0);
	let loadGeneration = 0;
	let activeController: AbortController | null = null;

	const modeLabel = $derived(question?.mode === 'frq' ? 'Written response' : 'Multiple choice');

	$effect(() => {
		startLoad(
			requestKey,
			untrack(() => toolInput)
		);
		return () => {
			activeController?.abort();
			activeController = null;
			loadGeneration += 1;
		};
	});

	function startLoad(key: string, inputSnapshot: CoachPracticeQuestionToolInput | null): void {
		activeController?.abort();
		const controller = new AbortController();
		activeController = controller;
		const generation = ++loadGeneration;
		resolved = false;
		loadError = '';
		question = null;
		if (!key || !inputSnapshot) {
			loadError = 'Pip could not start this practice question.';
			return;
		}
		void loadQuestion(inputSnapshot, generation, controller.signal);
	}

	async function loadQuestion(
		inputSnapshot: CoachPracticeQuestionToolInput,
		generation: number,
		signal: AbortSignal,
		attempt = 0
	): Promise<void> {
		try {
			const result = await fetchCoachPracticeQuestion(inputSnapshot, { signal });
			if (generation !== loadGeneration || signal.aborted) return;
			if ('error' in result) {
				const retryDelayMs = getCoachPracticeQuestionRetryDelayMs(result.retryAfterSeconds);
				if (retryDelayMs !== null && attempt < COACH_PRACTICE_QUESTION_MAX_AUTO_RETRIES) {
					await waitForRetry(retryDelayMs, signal);
					if (generation !== loadGeneration || signal.aborted) return;
					await loadQuestion(inputSnapshot, generation, signal, attempt + 1);
					return;
				}
				loadError = result.error;
				return;
			}
			question = result;
			requestVersion += 1;
		} catch {
			if (generation !== loadGeneration || signal.aborted) return;
			loadError = 'Could not load a practice question. Check your connection and try again.';
		}
	}

	function waitForRetry(delayMs: number, signal: AbortSignal): Promise<void> {
		return new Promise((resolve) => {
			const timeoutId = setTimeout(resolve, delayMs);
			const onAbort = () => {
				clearTimeout(timeoutId);
				resolve();
			};
			if (signal.aborted) {
				onAbort();
				return;
			}
			signal.addEventListener('abort', onAbort, { once: true });
		});
	}

	async function finish(output: CoachPracticeQuestionToolOutput): Promise<void> {
		if (resolved) return;
		if (await onResolve(output)) resolved = true;
	}

	function handleAnswered(result: AnswerResult): void {
		if (!question) return;
		finish(
			buildCoachPracticeQuestionToolOutput({
				status: 'answered',
				question,
				answer: result
			})
		);
	}

	function handleSkipped(): void {
		if (!question) return;
		finish(
			buildCoachPracticeQuestionToolOutput({
				status: 'skipped',
				question
			})
		);
	}

	function handleFrqGraded(attempt: FrqAttemptView): void {
		if (!question) return;
		finish(
			buildCoachPracticeQuestionToolOutput({
				status: 'answered',
				question,
				frqAttempt: attempt
			})
		);
	}
</script>

<figure class="mt-3 max-w-3xl overflow-hidden rounded-2xl border border-border/70 bg-card">
	<div class="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-3">
		<Badge variant="secondary">Practice question</Badge>
		{#if question}
			<span class="text-sm text-muted-foreground">
				{question.course} · {question.unit}
			</span>
			<span class="text-xs text-muted-foreground">{modeLabel}</span>
		{/if}
	</div>

	<div class="px-2 py-2 sm:px-4 sm:py-4">
		{#if loadError}
			<div class="space-y-3 px-2 py-4" role="alert" aria-live="assertive">
				<p class="text-sm text-muted-foreground">{loadError}</p>
				<Button
					size="sm"
					variant="outline"
					onclick={() => startLoad(requestKey, toolInput)}
					disabled={resolved}
				>
					Try again
				</Button>
			</div>
		{:else if !question}
			<div
				class="flex items-center gap-2 px-2 py-8 text-sm text-muted-foreground"
				role="status"
				aria-live="polite"
			>
				<Loader2Icon class="size-4 animate-spin" aria-hidden="true" />
				<span>Loading practice question…</span>
			</div>
		{:else if question.mode === 'mcq'}
			<QuestionCard
				model={unlimitedQuestionCardModel({
					selectedCourse: question.course,
					selectedUnit: question.unit,
					requestVersion,
					presetQuestionId: question.questionId
				})}
				tutorMode="hidden"
				showUtilityActions={true}
				showFirstUseHint={false}
				autoShowExplanation={true}
				skipLabel="Skip"
				checkLabel="Check answer"
				onAnswered={handleAnswered}
				onSkip={handleSkipped}
			/>
		{:else}
			<FrqSession
				selectedCourse={question.course}
				selectedUnit={question.unit}
				presetQuestionId={question.questionId}
				{requestVersion}
				tutorMode="hidden"
				onGraded={handleFrqGraded}
				onSkipped={handleSkipped}
				nextAfterGrade={false}
			/>
		{/if}
	</div>
</figure>
