<script lang="ts">
	import type { StatsData } from '$lib/users/types.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import FlameIcon from '@lucide/svelte/icons/flame';
	import TargetIcon from '@lucide/svelte/icons/target';
	import TrendingUpIcon from '@lucide/svelte/icons/trending-up';

	let {
		stats,
		frqEnabled = false
	}: {
		stats: StatsData | null | undefined;
		frqEnabled?: boolean;
	} = $props();

	const overview = $derived(stats?.overview);
	const questionsLast7Days = $derived(stats?.recentPerformance?.questionsLast7Days ?? 0);
</script>

<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
	<Card.Root class="rounded-2xl border border-border/60 p-4 shadow-sm ring-0">
		<div class="flex items-center gap-3">
			<div class="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
				<BookOpenIcon class="size-4" />
			</div>
			<div>
				<p class="text-2xl font-semibold tracking-tight">{overview?.totalQuestions ?? 0}</p>
				<p class="text-xs text-muted-foreground">Questions</p>
			</div>
		</div>
	</Card.Root>
	{#if frqEnabled}
		<Card.Root class="rounded-2xl border border-border/60 p-4 shadow-sm ring-0">
			<div class="flex items-center gap-3">
				<div
					class="flex size-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400"
				>
					<BookOpenIcon class="size-4" />
				</div>
				<div>
					<p class="text-2xl font-semibold tracking-tight">{overview?.frqSubmissions ?? 0}</p>
					<p class="text-xs text-muted-foreground">FRQ submissions</p>
				</div>
			</div>
		</Card.Root>
	{/if}
	<Card.Root class="rounded-2xl border border-border/60 p-4 shadow-sm ring-0">
		<div class="flex items-center gap-3">
			<div
				class="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
			>
				<TargetIcon class="size-4" />
			</div>
			<div>
				<p class="text-2xl font-semibold tracking-tight">{overview?.accuracy ?? 0}%</p>
				<p class="text-xs text-muted-foreground">Accuracy</p>
			</div>
		</div>
	</Card.Root>
	<Card.Root class="rounded-2xl border border-border/60 p-4 shadow-sm ring-0">
		<div class="flex items-center gap-3">
			<div
				class="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400"
			>
				<FlameIcon class="size-4" />
			</div>
			<div>
				<p class="text-2xl font-semibold tracking-tight">{overview?.currentStreak ?? 0}</p>
				<p class="text-xs text-muted-foreground">Day Streak</p>
			</div>
		</div>
	</Card.Root>
	<Card.Root class="rounded-2xl border border-border/60 p-4 shadow-sm ring-0">
		<div class="flex items-center gap-3">
			<div
				class="flex size-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400"
			>
				<TrendingUpIcon class="size-4" />
			</div>
			<div>
				<p class="text-2xl font-semibold tracking-tight">{questionsLast7Days}</p>
				<p class="text-xs text-muted-foreground">Last 7 Days</p>
			</div>
		</div>
	</Card.Root>
</div>
