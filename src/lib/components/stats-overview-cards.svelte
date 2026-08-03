<script lang="ts">
	import type { StatsData } from '$lib/users/types.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { performanceTextClass } from '$lib/components/app/performance.js';
	import { cn } from '$lib/utils.js';

	let {
		stats,
		frqEnabled = false
	}: {
		stats: StatsData | null | undefined;
		frqEnabled?: boolean;
	} = $props();

	const overview = $derived(stats?.overview);
	const questionsLast7Days = $derived(stats?.recentPerformance?.questionsLast7Days ?? 0);
	const accuracy = $derived(overview?.accuracy ?? 0);
	const streak = $derived(overview?.currentStreak ?? 0);
	const frqHint = $derived(
		frqEnabled && (overview?.frqSubmissions ?? 0) > 0
			? `${overview?.frqSubmissions ?? 0} FRQ all time`
			: undefined
	);
</script>

<div class="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
	<Card.Root class="rounded-2xl border border-border/60 p-4 shadow-sm ring-0">
		<p class="text-2xl font-semibold tracking-tight tabular-nums">
			{overview?.totalQuestions ?? 0}
		</p>
		<p class="mt-0.5 text-xs text-muted-foreground">Questions</p>
		{#if frqHint}
			<p class="mt-0.5 text-xs text-muted-foreground/80">{frqHint}</p>
		{/if}
	</Card.Root>

	<Card.Root class="rounded-2xl border border-border/60 p-4 shadow-sm ring-0">
		<p class={cn('text-2xl font-semibold tracking-tight tabular-nums', performanceTextClass(accuracy))}>
			{accuracy}%
		</p>
		<p class="mt-0.5 text-xs text-muted-foreground">Accuracy</p>
	</Card.Root>

	<Card.Root class="rounded-2xl border border-border/60 p-4 shadow-sm ring-0">
		<p
			class={cn(
				'text-2xl font-semibold tracking-tight tabular-nums',
				streak > 0 && 'text-amber-600 dark:text-amber-400'
			)}
		>
			{streak}
		</p>
		<p class="mt-0.5 text-xs text-muted-foreground">Day streak</p>
	</Card.Root>

	<Card.Root class="rounded-2xl border border-border/60 p-4 shadow-sm ring-0">
		<p
			class={cn(
				'text-2xl font-semibold tracking-tight tabular-nums',
				questionsLast7Days > 0 && 'text-primary'
			)}
		>
			{questionsLast7Days}
		</p>
		<p class="mt-0.5 text-xs text-muted-foreground">Last 7 days</p>
	</Card.Root>
</div>
