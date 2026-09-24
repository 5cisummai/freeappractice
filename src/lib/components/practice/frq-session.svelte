<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import EmptyState from '$lib/components/app/empty-state.svelte';
	import FullQuestion from '$lib/components/questions/full-question.svelte';
	import FrqResponse from '$lib/components/questions/frq-response.svelte';
	import FrqFeedback from '$lib/components/questions/frq-feedback.svelte';
	import QuestionTutor from '$lib/components/questions/question-tutor.svelte';
	import { createFrqCore } from '$lib/components/questions/frq-core.svelte.js';
	import { presentedStemFromFrq } from '$lib/components/questions/presented-question.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { FrqAttemptView } from '$lib/question-bank/frq/types';
	import type { ExamNavItem, TutorMode } from '$lib/question-bank/mcq/types';

	type FrqSessionProps = {
		selectedClass: string;
		selectedUnit: string;
		selectedFormat?: string;
		requestVersion: number;
		presetQuestionId?: string;
		tutorMode?: TutorMode;
		showFirstUseHint?: boolean;
		onGraded?: (attempt: FrqAttemptView) => void;
		onSkipped?: () => void;
		onExit?: () => void;
		nextAfterGrade?: boolean;
	};

	let {
		selectedClass,
		selectedUnit,
		selectedFormat = '',
		requestVersion,
		presetQuestionId = '',
		tutorMode = 'free',
		showFirstUseHint = false,
		onGraded,
		onSkipped,
		onExit,
		nextAfterGrade = true
	}: FrqSessionProps = $props();

	let mounted = $state(false);
	let flagged = $state(false);
	let stage = $state<'question' | 'review'>('question');

	const core = createFrqCore({
		getSelectedClass: () => selectedClass,
		getSelectedUnit: () => selectedUnit,
		getSelectedFormat: () => selectedFormat,
		getRequestVersion: () => requestVersion,
		getPresetQuestionId: () => presetQuestionId,
		getMounted: () => mounted,
		getOnGraded: () => onGraded,
		getOnSkip: () => onSkipped
	});

	const overlayOpen = $derived(requestVersion > 0 && Boolean(core.question));
	const navItems = $derived.by((): ExamNavItem[] => [
		{
			index: 0,
			loaded: true,
			answered: core.hasResponse || Boolean(core.grade),
			flagged,
			failed: false
		}
	]);

	$effect(() => {
		core.syncRequestVersion();
	});

	onMount(() => {
		mounted = true;
	});

	onDestroy(() => {
		mounted = false;
		core.destroy();
	});

	function handleClose(): void {
		onExit?.();
	}

	function enterReview(): void {
		stage = 'review';
	}

	function exitReviewTo(_index: number): void {
		stage = 'question';
	}

	function handleSkip(): void {
		flagged = false;
		stage = 'question';
		core.skip();
	}

	function handleNextQuestion(): void {
		flagged = false;
		stage = 'question';
		void core.nextQuestion();
	}

	async function handleReviewSubmit(): Promise<void> {
		if (core.grade || core.isGrading) return;
		await core.submit();
		stage = 'question';
	}
</script>

{#if core.isPoolWarming}
	<div class="space-y-4 rounded-2xl border border-border/70 bg-muted/20 p-6 text-center">
		<p class="text-sm font-medium">Written-response practice is warming up</p>
		<p class="text-sm text-muted-foreground">
			{core.statusMessage ||
				'This course unit is still being prepared. Your class and unit selection are unchanged.'}
		</p>
		<p class="text-xs text-muted-foreground">
			Typical wait about {core.poolWarmingRetryAfterSeconds}s
		</p>
		<Button onclick={() => void core.retryWarmingLoad()} disabled={core.isLoading}>
			{core.isLoading ? 'Checking…' : 'Retry now'}
		</Button>
	</div>
{:else if core.isLoading}
	<div class="rounded-2xl border border-border/70 p-8 text-center text-sm text-muted-foreground">
		Loading written-response practice…
	</div>
{:else if core.errorMessage}
	<div class="space-y-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
		<p class="text-sm text-destructive">{core.errorMessage}</p>
		<Button onclick={() => void core.loadQuestion()}>Try again</Button>
	</div>
{:else if core.showEmptyState}
	<EmptyState
		title="No prompt yet"
		description="Select a course and unit, then start a written-response task."
		imageUrl="/illustrations/lightbulb.png"
	/>
{:else if overlayOpen && core.question}
	{@const question = core.question}
	<FullQuestion
		stem={presentedStemFromFrq(question)}
		questionNumber={1}
		totalQuestions={1}
		title="Free Response"
		reviewTitle="Free Response"
		{stage}
		{flagged}
		{navItems}
		elapsedMs={core.elapsedMs}
		isLastQuestion
		prevDisabled
		nextActionLabel="Review"
		submitDisabled={!core.hasResponse || core.isGrading || Boolean(core.grade)}
		onToggleFlag={() => (flagged = !flagged)}
		onPrev={() => {}}
		onNext={enterReview}
		onGoTo={exitReviewTo}
		onEnterReview={enterReview}
		onSubmit={() => void handleReviewSubmit()}
		onClose={handleClose}
	>
		{#snippet response()}
			{#if core.grade}
				<FrqFeedback
					grade={core.grade}
					disagreementReported={core.disagreementReported}
					onReportDisagreement={core.reportDisagreement}
				/>
			{/if}
			<FrqResponse
				{question}
				responses={core.responses}
				grade={core.grade}
				disabled={Boolean(core.grade) || core.isGrading}
				onUpdate={core.updateResponse}
			/>
		{/snippet}

		{#snippet actions()}
			<div class="flex flex-wrap justify-end gap-2">
				<Button variant="outline" onclick={handleSkip} disabled={core.isGrading}>Skip</Button>
				{#if core.grade}
					{#if nextAfterGrade}
						<Button onclick={handleNextQuestion}>Next question</Button>
					{/if}
				{:else}
					<Button onclick={() => void core.submit()} disabled={!core.hasResponse || core.isGrading}>
						{core.isGrading ? 'Grading…' : 'Submit for feedback'}
					</Button>
				{/if}
			</div>
		{/snippet}

		{#snippet tools()}
			{#key question.questionId}
				<QuestionTutor
					{tutorMode}
					apClass={question.apClass}
					unit={question.unit}
					questionId={question.questionId}
					frqQuestionId={question.questionId}
					frqAttemptId={core.attemptId}
					topic={question.formatId}
					{showFirstUseHint}
				/>
			{/key}
		{/snippet}
	</FullQuestion>
{/if}
