<script lang="ts">
	import type { HistoryItem } from '$lib/types/history.js';
	import RichText from '$lib/components/rich-text.svelte';
	import * as Accordion from '$lib/components/ui/accordion/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { cn } from '$lib/utils.js';

	let { item, value }: { item: HistoryItem; value: string } = $props();

	const dateFormatter = new Intl.DateTimeFormat(undefined, {
		dateStyle: 'medium',
		timeStyle: 'short'
	});

	const attemptDate = $derived(
		item.attempt.attemptedAt ? dateFormatter.format(new Date(item.attempt.attemptedAt)) : ''
	);

	const timeLabel = $derived.by(() => {
		const ms = item.attempt.timeTakenMs;
		if (!ms || ms <= 0) return null;
		const seconds = Math.round(ms / 1000);
		if (seconds < 60) return `${seconds}s`;
		const minutes = Math.floor(seconds / 60);
		const rem = seconds % 60;
		return rem > 0 ? `${minutes}m ${rem}s` : `${minutes}m`;
	});

	const previewText = $derived.by(() => {
		const raw = item.question?.question ?? '';
		if (!raw) return 'Question unavailable';
		const plain = raw
			.replace(/\$\$[\s\S]*?\$\$/g, ' ')
			.replace(/\\\[([\s\S]*?)\\\]/g, ' ')
			.replace(/\$[^$]+\$/g, ' ')
			.replace(/[#*_`>[\]()]/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
		if (plain.length <= 120) return plain;
		return `${plain.slice(0, 120)}…`;
	});

	const options = $derived.by(() => {
		const q = item.question;
		if (!q) return [];
		return [
			{ id: 'A' as const, text: q.optionA },
			{ id: 'B' as const, text: q.optionB },
			{ id: 'C' as const, text: q.optionC },
			{ id: 'D' as const, text: q.optionD }
		];
	});
</script>

<Accordion.Item {value} class="rounded-lg border border-border bg-card px-4">
	<Accordion.Trigger class="py-4 hover:no-underline">
		<div
			class="flex w-full flex-col gap-2 text-left sm:flex-row sm:items-start sm:justify-between sm:gap-4"
		>
			<div class="min-w-0 flex-1 space-y-1">
				<div class="flex flex-wrap items-center gap-2">
					<span class="text-sm font-medium">{item.attempt.apClass}</span>
					{#if item.attempt.unit}
						<span class="text-xs text-muted-foreground">· {item.attempt.unit}</span>
					{/if}
				</div>
				<p class="line-clamp-2 text-sm text-muted-foreground">{previewText}</p>
				<p class="text-xs text-muted-foreground">
					{attemptDate}
					{#if timeLabel}
						· {timeLabel}
					{/if}
					· You chose {item.attempt.selectedAnswer}
				</p>
			</div>
			<Badge variant={item.attempt.wasCorrect ? 'secondary' : 'destructive'}>
				{item.attempt.wasCorrect ? 'Correct' : 'Incorrect'}
			</Badge>
		</div>
	</Accordion.Trigger>
	<Accordion.Content class="pb-4">
		{#if !item.question}
			<p class="text-sm text-muted-foreground">
				This question is no longer available in storage. Your attempt was still recorded.
			</p>
		{:else}
			<div class="space-y-4 border-t border-border pt-4">
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
			</div>
		{/if}
	</Accordion.Content>
</Accordion.Item>
