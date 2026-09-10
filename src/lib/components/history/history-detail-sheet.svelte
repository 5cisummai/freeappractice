<script lang="ts">
	import { resolve } from '$app/paths';
	import ArrowRightIcon from '@tabler/icons-svelte/icons/arrow-right';
	import type { HistoryItem } from '$lib/users/types.js';
	import type { FrqAttemptView } from '$lib/question-bank/frq/types.js';
	import { formatAttemptDate, formatTimeTaken } from '$lib/history-display.js';
	import { apiFetch, readJsonOrNull } from '$lib/client/api.js';
	import { getHistoryMcqQuestion } from '$lib/users/history-question.client.js';
	import RichText from '$lib/components/content/rich-text.svelte';
	import ExamfigDiagram from '$lib/components/questions/examfig-diagram.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
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

	async function loadFrqAttempt(attemptId: string): Promise<FrqAttemptView> {
		const response = await apiFetch(`/api/me/frq-attempt/${encodeURIComponent(attemptId)}`);
		const payload = await readJsonOrNull<{ attempt?: FrqAttemptView; error?: string }>(response);
		if (!response.ok || !payload?.attempt) {
			throw new Error(payload?.error ?? 'Could not load written-response feedback.');
		}
		return payload.attempt;
	}

	function practiceHref(): string {
		if (!item) return resolve('/app/practice');
		const unitParam = item.attempt.unit ? `&unit=${encodeURIComponent(item.attempt.unit)}` : '';
		return `${resolve('/app/practice')}?apClass=${encodeURIComponent(item.attempt.apClass)}${unitParam}`;
	}
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
					{:else if item.kind === 'quiz'}
						<Badge variant={item.attempt.scorePercent >= 70 ? 'secondary' : 'outline'}>
							{item.attempt.scorePercent}% · Quiz
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
					{:else if item.kind === 'quiz'}
						· {item.attempt.correctCount}/{item.attempt.requestedCount} correct
					{:else if item.attempt.selectedAnswer}
						· You chose {item.attempt.selectedAnswer}
					{/if}
				</Sheet.Description>
			</Sheet.Header>

			<div class="space-y-6 p-6">
				{#if item.kind === 'frq'}
					{#key item.attempt.id}
						{#await loadFrqAttempt(item.attempt.id)}
							<p class="text-sm text-muted-foreground">Loading rubric feedback…</p>
						{:then frqDetail}
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
											<p class="mt-1 text-sm leading-6 text-muted-foreground">
												{criterion.feedback}
											</p>
										</div>
									{/each}
								</div>
							</div>
						{:catch error}
							<p class="text-sm text-destructive">
								{error instanceof Error
									? error.message
									: 'Could not load written-response feedback.'}
							</p>
						{/await}
					{/key}
				{:else if item.kind === 'quiz'}
					<div class="space-y-4">
						<div>
							<p class="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
								Quiz summary
							</p>
							<p class="text-sm leading-6">
								You answered {item.attempt.answeredCount} of {item.attempt.requestedCount} questions,
								with {item.attempt.correctCount} correct and {item.attempt.incorrectCount} incorrect.
							</p>
						</div>
						<div
							class="grid grid-cols-3 divide-x divide-border border-y border-border py-3 text-center"
						>
							<div>
								<p class="font-semibold text-emerald-600 dark:text-emerald-400">
									{item.attempt.correctCount}
								</p>
								<p class="text-xs text-muted-foreground">Correct</p>
							</div>
							<div>
								<p class="font-semibold text-red-600 dark:text-red-400">
									{item.attempt.incorrectCount}
								</p>
								<p class="text-xs text-muted-foreground">Incorrect</p>
							</div>
							<div>
								<p class="font-semibold text-muted-foreground">
									{item.attempt.requestedCount - item.attempt.answeredCount}
								</p>
								<p class="text-xs text-muted-foreground">Unanswered</p>
							</div>
						</div>
					</div>
				{:else}
					{#key item.attempt.questionId}
						{#await getHistoryMcqQuestion(item.attempt.questionId)}
							<p class="text-sm text-muted-foreground">Loading question…</p>
						{:then mcqQuestion}
							{@const options = [
								{ id: 'A' as const, text: mcqQuestion.optionA },
								{ id: 'B' as const, text: mcqQuestion.optionB },
								{ id: 'C' as const, text: mcqQuestion.optionC },
								{ id: 'D' as const, text: mcqQuestion.optionD }
							]}
							{@const diagramSpec = mcqQuestion.stimulus?.diagramSpec ?? mcqQuestion.diagramSpec}
							{#if mcqQuestion.stimulus || diagramSpec}
								<div class="space-y-3">
									<p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
										Stimulus
									</p>
									{#if mcqQuestion.stimulus?.text}
										<RichText text={mcqQuestion.stimulus.text} class="text-sm" />
									{/if}
									{#if diagramSpec}
										<ExamfigDiagram spec={diagramSpec} />
									{/if}
								</div>
							{/if}
							<div>
								<p class="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
									Question
								</p>
								<RichText text={mcqQuestion.question} class="text-sm" />
							</div>

							<div class="space-y-2">
								<p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
									Options
								</p>
								<ul class="space-y-2">
									{#each options as option (option.id)}
										<li
											class={cn(
												'rounded-md border px-3 py-2 text-sm',
												option.id === mcqQuestion.correctAnswer &&
													'border-emerald-500/50 bg-emerald-500/5',
												option.id === item.attempt.selectedAnswer &&
													option.id !== mcqQuestion.correctAnswer &&
													'border-destructive/50 bg-destructive/5',
												option.id === item.attempt.selectedAnswer &&
													option.id === mcqQuestion.correctAnswer &&
													'border-emerald-500/50 bg-emerald-500/10'
											)}
										>
											<span class="font-medium">{option.id}.</span>
											<RichText text={option.text} inline class="inline" />
										</li>
									{/each}
								</ul>
							</div>

							{#if mcqQuestion.explanation}
								<div>
									<p class="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
										Explanation
									</p>
									<RichText text={mcqQuestion.explanation} class="text-sm text-muted-foreground" />
								</div>
							{/if}
						{:catch error}
							<p class="text-sm text-destructive">
								{error instanceof Error ? error.message : 'Could not load this question.'}
							</p>
						{/await}
					{/key}
				{/if}

				<div class="border-t border-border/60 pt-5">
					<Button href={practiceHref()} variant="outline">
						Practice a similar question
						<ArrowRightIcon class="size-4" aria-hidden="true" />
					</Button>
				</div>
			</div>
		{/if}
	</Sheet.Content>
</Sheet.Root>
