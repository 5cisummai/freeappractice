<script lang="ts">
	import Loader2Icon from '@tabler/icons-svelte/icons/loader-2';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import QuestionCard from '$lib/components/questions/question-card.svelte';
	import FrqCard from '$lib/components/questions/frq-card.svelte';
	import { unlimitedQuestionCardModel } from '$lib/question-bank/question-card-model';
	import type { AnswerResult } from '$lib/question-bank/mcq/types';
	import type { FrqAttemptView } from '$lib/question-bank/frq/types';
	import { fetchCoachPracticeQuestion } from '$lib/super/coach-practice-question.client';
	import {
		buildCoachPracticeQuestionToolOutput,
		getCoachPracticeQuestionToolInput,
		type CoachPracticeQuestionOutput,
		type CoachPracticeQuestionToolOutput
	} from '$lib/super/coach-practice-question';

	let {
		input,
		onResolve
	}: {
		input: unknown;
		onResolve: (output: CoachPracticeQuestionToolOutput) => Promise<boolean>;
	} = $props();

	const toolInput = $derived(getCoachPracticeQuestionToolInput(input));
	let question = $state<CoachPracticeQuestionOutput | null>(null);
	let loadError = $state('');
	let resolved = $state(false);
	let requestVersion = $state(0);
	let loadGeneration = 0;

	const modeLabel = $derived(question?.mode === 'frq' ? 'Written response' : 'Multiple choice');

	$effect(() => {
		const inputSnapshot = toolInput;
		const generation = ++loadGeneration;
		resolved = false;
		loadError = '';
		question = null;
		if (!inputSnapshot) {
			loadError = 'Coach could not start this practice question.';
			return;
		}
		void loadQuestion(inputSnapshot, generation);
	});

	async function loadQuestion(
		inputSnapshot: NonNullable<typeof toolInput>,
		generation: number
	): Promise<void> {
		const result = await fetchCoachPracticeQuestion(inputSnapshot);
		if (generation !== loadGeneration) return;
		if ('error' in result) {
			loadError = result.error;
			return;
		}
		question = result;
		requestVersion += 1;
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
				{question.apClass} · {question.unit}
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
					onclick={() => {
						const inputSnapshot = toolInput;
						if (!inputSnapshot) return;
						const generation = ++loadGeneration;
						loadError = '';
						question = null;
						void loadQuestion(inputSnapshot, generation);
					}}
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
					selectedClass: question.apClass,
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
			<FrqCard
				selectedClass={question.apClass}
				selectedUnit={question.unit}
				presetQuestionId={question.questionId}
				{requestVersion}
				tutorMode="hidden"
				onGraded={handleFrqGraded}
				onSkip={handleSkipped}
				skipAfterGrade={false}
			/>
		{/if}
	</div>
</figure>
