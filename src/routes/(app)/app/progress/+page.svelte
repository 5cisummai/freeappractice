<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ProgressEntry, StatsData } from '$lib/types/user-stats.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import PageShell from '$lib/components/page-shell.svelte';

	let { data } = $props();

	const progressData = $derived(data.progress as ProgressEntry[]);
	const statsData = $derived(data.stats as StatsData);

	const grouped = $derived(() => {
		const map: Record<string, ProgressEntry[]> = {};
		for (const p of progressData) {
			if (!map[p.apClass]) map[p.apClass] = [];
			map[p.apClass].push(p);
		}
		return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
	});
</script>

<svelte:head>
	<title>Progress – Free AP Practice</title>
</svelte:head>

<PageShell title="Your Progress" description="Track your performance across all AP subjects.">
	<!-- Overview stats -->
	<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
				<Card.Root class="p-4 text-center">
					<p class="text-2xl font-bold">{statsData.overview.totalQuestions}</p>
					<p class="mt-1 text-xs text-muted-foreground">Questions Answered</p>
				</Card.Root>
				<Card.Root class="p-4 text-center">
					<p class="text-2xl font-bold">{statsData.overview.accuracy}%</p>
					<p class="mt-1 text-xs text-muted-foreground">Overall Accuracy</p>
				</Card.Root>
				<Card.Root class="p-4 text-center">
					<p class="text-2xl font-bold">{statsData.overview.currentStreak}</p>
					<p class="mt-1 text-xs text-muted-foreground">Day Streak</p>
				</Card.Root>
				<Card.Root class="p-4 text-center">
					<p class="text-2xl font-bold">{statsData.recentPerformance.questionsLast7Days}</p>
					<p class="mt-1 text-xs text-muted-foreground">Last 7 Days</p>
				</Card.Root>
			</div>

	<!-- Per-subject breakdown -->
		{#if grouped().length === 0}
			<div class="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
				<p>No progress yet. Go practice some questions!</p>
				<a
					href={resolve('/app/practice')}
					class="mt-4 inline-block text-sm underline underline-offset-4">Start practicing →</a
				>
			</div>
		{:else}
			<div class="space-y-6">
				{#each grouped() as [apClass, units] (apClass)}
					<Card.Root>
						<Card.Header>
							<Card.Title>{apClass}</Card.Title>
						</Card.Header>
						<Card.Content>
							<div class="space-y-3">
								{#each units as unit (`${apClass}:${unit.unit || 'all-units'}`)}
									<div class="flex items-center gap-4">
										<div class="min-w-0 flex-1">
											<p class="truncate text-sm font-medium">{unit.unit || 'All Units'}</p>
											<p class="text-xs text-muted-foreground">{unit.totalAttempts} attempts</p>
										</div>
										<div class="w-32">
											<div class="mb-1 flex justify-between text-xs text-muted-foreground">
												<span>Mastery</span>
												<span>{unit.mastery}%</span>
											</div>
											<div class="h-2 w-full overflow-hidden rounded-full bg-muted">
												<div
													class="h-full rounded-full bg-primary transition-all"
													style="width: {unit.mastery}%"
												></div>
											</div>
										</div>
									</div>
								{/each}
							</div>
						</Card.Content>
					</Card.Root>
				{/each}
			</div>
		{/if}
</PageShell>
