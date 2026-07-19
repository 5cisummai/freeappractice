<script lang="ts">
	import { onMount } from 'svelte';
	import type { HistoryItem } from '$lib/users/types.js';
	import type { FrqAttemptView } from '$lib/frq/types.js';
	import { formatAttemptDate, formatTimeTaken } from '$lib/history-display.js';
	import { apiFetch, readJsonOrNull } from '$lib/client/api.js';
	import RichText from '$lib/components/content/rich-text.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import { cn } from '$lib/utils.js';

	let {
		item = null,
		open = $bindable(false)
	}: {
		item: HistoryItem | null;
		open?: boolean;
	} = $props();

	const attemptDate = $derived(
		item?.attempt.attemptedAt ? formatAttemptDate(item.attempt.attemptedAt) : ''
	);

	const timeLabel = $derived(item ? formatTimeTaken(item.attempt.timeTakenMs) : null);
	let frqDetail = $state<FrqAttemptView | null>(null);
	let frqDetailLoading = $state(false);
	let frqDetailError = $state('');

	async function loadFrqDetail(attemptId: string): Promise<void> {
		frqDetailLoading = true;
		frqDetailError = '';
		try {
			const response = await apiFetch(`/api/me/frq-attempt/${encodeURIComponent(attemptId)}`);
			const payload = await readJsonOrNull<{ attempt?: FrqAttemptView; error?: string }>(response);
			if (!response.ok || !payload?.attempt) {
				throw new Error(payload?.error ?? 'Could not load written-response feedback.');
			}
			frqDetail = payload.attempt;
		} catch (error) {
			frqDetailError =
				error instanceof Error ? error.message : 'Could not load written-response feedback.';
		} finally {
			frqDetailLoading = false;
		}
	}

	onMount(() => {
		if (open && item?.kind === 'frq') void loadFrqDetail(item.attempt.id);
	});

	const options = $derived.by(() => {
		const q = item?.question;
		if (!q) return [];
		return [
			{ id: 'A' as const, text: q.optionA },
			{ id: 'B' as const, text: q.optionB },
			{ id: 'C' as const, text: q.optionC },
			{ id: 'D' as const, text: q.optionD }
		];
	});
</script>

<Sheet.Root bind:open>
	<Sheet.Content
		side="right"
		class="w-full gap-0 overflow-y-auto p-0 sm:max-w-2xl data-[side=right]:sm:max-w-2xl"
	>
		{#if item}
			<Sheet.Header class="space-y-3 border-b border-border/60 p-6 pr-14 text-left">
				<div class="flex flex-wrap items-center gap-2">
					<Sheet.Title class="text-base">{item.attempt.apClass}</Sheet.Title>
					{#if item.attempt.unit}
						<span class="text-sm text-muted-foreground">· {item.attempt.unit}</span>
					{/if}
					{#if item.kind === 'frq'}
						<Badge variant={item.attempt.percentage >= 70 ? 'secondary' : 'outline'}>
							{item.attempt.percentage}% · FRQ
						</Badge>
					{:else}
						<Badge
							variant={item.attempt.wasCorrect === undefined
								? 'outline'
								: item.attempt.wasCorrect
									? 'secondary'
									: 'destructive'}
						>
							{item.attempt.wasCorrect === undefined
								? 'Revealed'
								: item.attempt.wasCorrect
									? 'Correct'
									: 'Incorrect'}
						</Badge>
					{/if}
				</div>
				<Sheet.Description>
					{attemptDate}
					{#if timeLabel}
						· {timeLabel}
					{/if}
					{#if item.kind === 'frq'}
						· {item.attempt.pointsEarned}/{item.attempt.pointsAvailable} points
					{:else}
						{#if item.attempt.selectedAnswer}
							· You chose {item.attempt.selectedAnswer}
						{:else}
							· No answer submitted
						{/if}
						{#if item.attempt.finalAnswer && item.attempt.finalAnswer !== item.attempt.selectedAnswer}
							· Later resolved to {item.attempt.finalAnswer} after hints
						{/if}
					{/if}
				</Sheet.Description>
			</Sheet.Header>

			<div class="space-y-6 p-6">
				{#if item.kind === 'frq'}
					{#if frqDetailLoading}
						<p class="text-sm text-muted-foreground">Loading rubric feedback…</p>
					{:else if frqDetailError}
						<p class="text-sm text-destructive">{frqDetailError}</p>
					{:else if frqDetail}
						<div class="space-y-4">
							<div>
								<p class="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
									Overall feedback
								</p>
								<p class="text-sm leading-6">{frqDetail.grade.overallFeedback}</p>
							</div>
							<div class="space-y-3">
								<p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
									Criterion feedback
								</p>
								{#each frqDetail.grade.criteria as criterion (criterion.criterionId)}
									<div class="rounded-xl border border-border/70 p-4">
										<div class="flex items-center justify-between gap-3">
											<p class="text-sm font-medium">{criterion.label}</p>
											<p class="text-sm font-semibold tabular-nums">
												{criterion.points}/{criterion.pointsAvailable}
											</p>
										</div>
										<p class="mt-1 text-sm leading-6 text-muted-foreground">{criterion.feedback}</p>
									</div>
								{/each}
							</div>
						</div>
					{:else}
						<p class="text-sm text-muted-foreground">This attempt is unavailable.</p>
					{/if}
				{:else if !item.question}
					<p class="text-sm text-muted-foreground">
						This question is no longer available in storage. Your attempt was still recorded.
					</p>
				{:else}
					<div>
						<p class="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
							Question
						</p>
						<RichText text={item.question.question} class="text-sm" />
					</div>

					<div class="space-y-2">
						<p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Options</p>
						<ul class="space-y-2">
							{#each options as option (option.id)}
								<li
									class={cn(
										'rounded-md border px-3 py-2 text-sm',
										option.id === item.question?.correctAnswer &&
											'border-emerald-500/50 bg-emerald-500/5',
										option.id === item.attempt.selectedAnswer &&
											option.id !== item.question?.correctAnswer &&
											'border-destructive/50 bg-destructive/5',
										option.id === item.attempt.selectedAnswer &&
											option.id === item.question?.correctAnswer &&
											'border-emerald-500/50 bg-emerald-500/10'
									)}
								>
									<span class="font-medium">{option.id}.</span>
									<RichText text={option.text} inline class="inline" />
								</li>
							{/each}
						</ul>
					</div>

					{#if item.question.explanation}
						<div>
							<p class="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
								Explanation
							</p>
							<RichText text={item.question.explanation} class="text-sm text-muted-foreground" />
						</div>
					{/if}
				{/if}
			</div>
		{/if}
	</Sheet.Content>
</Sheet.Root>
