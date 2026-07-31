<script lang="ts">
	import type { StatsData } from '$lib/users/types.js';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import AccuracyRingTile from '$lib/components/app/accuracy-ring-tile.svelte';
	import StatTile from '$lib/components/app/stat-tile.svelte';
	import StreakWeekTile from '$lib/components/app/streak-week-tile.svelte';

	let {
		stats,
		frqEnabled = false
	}: {
		stats: StatsData | null | undefined;
		frqEnabled?: boolean;
	} = $props();

	const overview = $derived(stats?.overview);
	const questionsLast7Days = $derived(stats?.recentPerformance?.questionsLast7Days ?? 0);
	const activity = $derived(
		stats?.activityLast7Days ?? [false, false, false, false, false, false, false]
	);
</script>

<div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
	<StatTile
		label="Last 7 days"
		value={questionsLast7Days}
		hint={frqEnabled && (overview?.frqSubmissions ?? 0) > 0
			? `${overview?.frqSubmissions ?? 0} FRQ all time`
			: 'Questions answered'}
	>
		{#snippet icon()}
			<BookOpenIcon class="size-4" />
		{/snippet}
	</StatTile>

	<StreakWeekTile activityLast7Days={activity} currentStreak={overview?.currentStreak ?? 0} />

	<AccuracyRingTile accuracy={overview?.accuracy ?? 0} />

	<StatTile label="Questions" value={overview?.totalQuestions ?? 0} hint="Answered all time">
		{#snippet icon()}
			<BookOpenIcon class="size-4" />
		{/snippet}
	</StatTile>
</div>
