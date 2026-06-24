<script lang="ts">
	import type { HistoryItem } from '$lib/users/types.js';
	import { formatAttemptDate, formatTimeTaken } from '$lib/history-display.js';
	import RichText from '$lib/components/rich-text.svelte';
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
	<Sheet.Content side="right" class="w-full overflow-y-auto sm:max-w-lg">
		{#if item}
			<Sheet.Header class="space-y-3 text-left">
				<div class="flex flex-wrap items-center gap-2">
					<Sheet.Title class="text-base">{item.attempt.apClass}</Sheet.Title>
					{#if item.attempt.unit}
						<span class="text-sm text-muted-foreground">· {item.attempt.unit}</span>
					{/if}
					<Badge variant={item.attempt.wasCorrect ? 'secondary' : 'destructive'}>
						{item.attempt.wasCorrect ? 'Correct' : 'Incorrect'}
					</Badge>
				</div>
				<Sheet.Description>
					{attemptDate}
					{#if timeLabel}
						· {timeLabel}
					{/if}
					· You chose {item.attempt.selectedAnswer}
				</Sheet.Description>
			</Sheet.Header>

			<div class="mt-6 space-y-6">
				{#if !item.question}
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
