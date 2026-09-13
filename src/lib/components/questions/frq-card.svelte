<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import RichText from '$lib/components/content/rich-text.svelte';
	import type { FrqAttemptView } from '$lib/question-bank/frq/types.js';
	import type { TutorMode } from '$lib/question-bank/mcq/types.js';
	import TutorWidget from '$lib/components/questions/tutor-widget.svelte';
	import SuperTutorWidget from '$lib/components/questions/super-tutor-widget.svelte';
	import EmptyState from '$lib/components/app/empty-state.svelte';
	import FrqResponse from '$lib/components/questions/frq-response.svelte';
	import FrqFeedback from '$lib/components/questions/frq-feedback.svelte';
	import { createFrqCore } from '$lib/components/questions/frq-core.svelte.js';
	const lightbulbImage = '/illustrations/lightbulb.png';

	type Props = {
		selectedClass?: string;
		selectedUnit?: string;
		unitRange?: readonly number[];
		requestVersion?: number;
		presetQuestionId?: string;
		showFirstUseHint?: boolean;
		tutorMode?: TutorMode;
		isPersonalizedTutor?: boolean;
		onGraded?: (attempt: FrqAttemptView) => void;
		onSkip?: () => void;
		skipAfterGrade?: boolean;
	};

	let {
		selectedClass = '',
		selectedUnit = '',
		unitRange,
		requestVersion = 0,
		presetQuestionId = '',
		showFirstUseHint = false,
		isPersonalizedTutor = false,
		tutorMode = isPersonalizedTutor ? 'personalized' : 'free',
		onGraded,
		onSkip,
		skipAfterGrade = true
	}: Props = $props();

	let mounted = $state(false);

	const core = createFrqCore({
		getSelectedClass: () => selectedClass,
		getSelectedUnit: () => selectedUnit,
		getUnitRange: () => unitRange,
		getRequestVersion: () => requestVersion,
		getPresetQuestionId: () => presetQuestionId,
		getMounted: () => mounted,
		getOnGraded: () => onGraded,
		getOnSkip: () => onSkip
	});

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
		imageUrl={lightbulbImage}
	/>
{:else if core.question}
	{@const question = core.question}
	<div class="space-y-5">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div>
				<p class="text-sm font-medium text-primary">Written-response practice</p>
				<p class="text-xs text-muted-foreground">
					{question.apClass} · {question.unit} · {question.totalPoints} points
				</p>
			</div>
			<p class="text-sm text-muted-foreground">{core.statusMessage}</p>
		</div>

		<div class="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-7">
			<div class="space-y-5">
				<div class="space-y-2">
					<h2 class="font-display text-xl font-medium tracking-tight">Prompt</h2>
					<RichText text={question.prompt} class="leading-7" />
				</div>

				{#if question.materials.length > 0}
					<div class="space-y-3 rounded-xl bg-muted/30 p-4">
						<p class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
							Materials
						</p>
						{#each question.materials as material (material.id)}
							<div class="space-y-1">
								{#if material.title}<p class="text-sm font-medium">{material.title}</p>{/if}
								<RichText text={material.content} class="text-sm leading-6" />
							</div>
						{/each}
					</div>
				{/if}

				<FrqResponse
					{question}
					responses={core.responses}
					disabled={Boolean(core.grade) || core.isGrading}
					onUpdate={core.updateResponse}
				/>

				<div class="flex flex-wrap justify-end gap-2 border-t border-border/70 pt-5">
					<Button variant="outline" onclick={core.skip} disabled={core.isGrading}>Skip</Button>
					{#if core.grade}
						{#if skipAfterGrade}
							<Button onclick={() => void core.nextQuestion()}>Next question</Button>
						{/if}
					{:else}
						<Button onclick={() => void core.submit()} disabled={!core.hasResponse || core.isGrading}>
							{core.isGrading ? 'Grading…' : 'Submit for feedback'}
						</Button>
					{/if}
				</div>
			</div>
		</div>

		{#if core.grade}
			<FrqFeedback
				grade={core.grade}
				disagreementReported={core.disagreementReported}
				onReportDisagreement={core.reportDisagreement}
			/>
		{/if}

		{#key question.questionId}
			{#if tutorMode !== 'hidden'}
				{#if tutorMode === 'personalized'}
					<SuperTutorWidget
						apClass={question.apClass}
						unit={question.unit}
						questionId={question.questionId}
						frqQuestionId={question.questionId}
						frqAttemptId={core.attemptId}
						topic={question.formatId}
						{showFirstUseHint}
					/>
				{:else}
					<TutorWidget
						apClass={question.apClass}
						unit={question.unit}
						questionId={question.questionId}
						frqQuestionId={question.questionId}
						frqAttemptId={core.attemptId}
						topic={question.formatId}
						{isPersonalizedTutor}
						{showFirstUseHint}
					/>
				{/if}
			{/if}
		{/key}
	</div>
{/if}
