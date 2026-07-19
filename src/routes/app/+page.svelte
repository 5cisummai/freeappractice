<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ProgressEntry, StatsData } from '$lib/users/types.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import BarChart3Icon from '@lucide/svelte/icons/bar-chart-3';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import PageShell from '$lib/components/layout/page-shell.svelte';
	import StatsOverviewCards from '$lib/components/stats-overview-cards.svelte';

	let { data } = $props();

	const statsData = $derived(data.stats as StatsData);
	const progressData = $derived(data.progress as ProgressEntry[]);
	const frqEnabled = $derived(Boolean(data.frqEnabled));

	const nextBestUnit = $derived.by(() => {
		if (!progressData.length) return null;
		const entries = progressData.filter((entry) => !!entry.apClass);
		const lowFrq = frqEnabled
			? entries
					.filter((entry) => (entry.frqAttempts ?? 0) > 0 && (entry.frqAveragePercentage ?? 0) < 70)
					.sort((a, b) => (a.frqAveragePercentage ?? 0) - (b.frqAveragePercentage ?? 0))[0]
			: undefined;
		const lowMcq = entries
			.filter((entry) => entry.totalAttempts > 0)
			.sort((a, b) => a.mastery - b.mastery || a.totalAttempts - b.totalAttempts)[0];
		const frqOnly = frqEnabled
			? entries
					.filter((entry) => (entry.frqAttempts ?? 0) > 0)
					.sort((a, b) => (a.frqAveragePercentage ?? 0) - (b.frqAveragePercentage ?? 0))[0]
			: undefined;
		return lowFrq ?? lowMcq ?? frqOnly ?? null;
	});
	const frqRecommendation = $derived(
		Boolean(
			frqEnabled &&
			nextBestUnit &&
			(nextBestUnit.frqAveragePercentage ?? 100) < 70 &&
			(nextBestUnit.frqAttempts ?? 0) > 0
		)
	);

	const recommendedPracticeHref = $derived.by(() => {
		const recommendation = nextBestUnit;
		if (!recommendation) return resolve('/app/practice');
		const basePath = resolve('/app/practice');
		const classParam = `apClass=${encodeURIComponent(recommendation.apClass)}`;
		const unitParam = recommendation.unit ? `&unit=${encodeURIComponent(recommendation.unit)}` : '';
		const modeParam = frqRecommendation ? '&mode=frq' : '';
		return `${basePath}?${classParam}${unitParam}${modeParam}`;
	});

	const firstName = $derived.by(() => {
		const name = data.user.name?.trim();
		if (!name) return 'Student';
		return name.split(' ')[0] || 'Student';
	});
</script>

<svelte:head>
	<title>Dashboard – Free AP Practice</title>
</svelte:head>

<PageShell
	title={`Welcome back, ${firstName}`}
	description="Here's an overview of your study progress."
	maskTitle
>
	<Card.Root
		class="rounded-2xl border border-border/60 border-primary/30 bg-primary/3 p-5 shadow-sm ring-0"
	>
		<div class="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
			<div class="space-y-1.5">
				<p class="text-sm font-medium text-primary">Your Next Best Unit</p>
				{#if nextBestUnit}
					<p class="text-base font-semibold">
						{nextBestUnit.apClass}
						{#if nextBestUnit.unit}
							- {nextBestUnit.unit}
						{/if}
					</p>
					<p class="text-sm text-muted-foreground">
						{#if frqRecommendation}
							FRQ average {nextBestUnit.frqAveragePercentage ?? 0}% across
							{nextBestUnit.frqAttempts ?? 0} submissions.
						{:else if nextBestUnit.totalAttempts > 0}
							MCQ mastery {nextBestUnit.mastery}% across {nextBestUnit.totalAttempts} attempts.
						{:else}
							FRQ average {nextBestUnit.frqAveragePercentage ?? 0}% across
							{nextBestUnit.frqAttempts ?? 0} submissions.
						{/if}
					</p>
				{:else}
					<p class="text-base font-semibold">Start your first focused practice session</p>
					<p class="text-sm text-muted-foreground">
						We'll personalize this recommendation once you complete a few attempts.
					</p>
				{/if}
			</div>
			<Button href={recommendedPracticeHref} class="rounded-full">
				Start Recommended Practice
			</Button>
		</div>
	</Card.Root>

	{#if (statsData?.overview.totalQuestions ?? 0) > 0 || (frqEnabled && (statsData?.overview.frqSubmissions ?? 0) > 0)}
		<p class="text-sm text-muted-foreground">
			<a
				href="{resolve('/app/progress')}?view=history"
				class="underline underline-offset-4 hover:text-foreground"
			>
				View full question history →
			</a>
		</p>
	{/if}

	<StatsOverviewCards stats={statsData} {frqEnabled} />

	<div>
		<h2 class="mb-4 font-display text-xl font-medium tracking-tight sm:text-2xl">Quick Actions</h2>
		<div class="grid gap-4 sm:grid-cols-2">
			<a href={resolve('/app/practice')} class="block">
				<Card.Root
					class="flex items-center gap-4 rounded-2xl border border-border/60 p-5 shadow-sm ring-0 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-muted/20 hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none"
				>
					<div
						class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
					>
						<BookOpenIcon class="h-5 w-5" />
					</div>
					<div>
						<p class="font-medium">Start Practicing</p>
						<p class="text-sm text-muted-foreground">Generate questions and test your knowledge</p>
					</div>
				</Card.Root>
			</a>
			<a href={resolve('/app/progress')} class="block">
				<Card.Root
					class="flex items-center gap-4 rounded-2xl border border-border/60 p-5 shadow-sm ring-0 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-muted/20 hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none"
				>
					<div
						class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
					>
						<BarChart3Icon class="h-5 w-5" />
					</div>
					<div>
						<p class="font-medium">View Progress</p>
						<p class="text-sm text-muted-foreground">Track mastery across AP subjects and units</p>
					</div>
				</Card.Root>
			</a>
		</div>
	</div>

	{#if statsData?.subjectBreakdown && statsData.subjectBreakdown.length > 0}
		<div>
			<h2 class="mb-4 font-display text-xl font-medium tracking-tight sm:text-2xl">
				Subject Performance
			</h2>
			<Card.Root class="rounded-2xl border border-border/60 shadow-sm ring-0">
				<div class="divide-y divide-border/70">
					{#each statsData.subjectBreakdown as subject (subject.subject)}
						<div class="flex items-center gap-4 px-5 py-3.5">
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium">{subject.subject}</p>
								<p class="text-xs text-muted-foreground">{subject.total} questions</p>
							</div>
							<div class="flex items-center gap-3 text-right">
								<div class="w-24">
									<div class="h-2 w-full overflow-hidden rounded-full bg-muted">
										<div
											class="h-full rounded-full bg-primary transition-all"
											style="width: {subject.accuracy}%"
										></div>
									</div>
								</div>
								<span class="w-12 text-sm font-medium tabular-nums">{subject.accuracy}%</span>
							</div>
							{#if subject.avgTimeSeconds}
								<div class="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
									<ClockIcon class="h-3 w-3" />
									<span>{Math.round(subject.avgTimeSeconds)}s avg</span>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</Card.Root>
		</div>
	{/if}

	{#if !statsData || (statsData.overview.totalQuestions === 0 && statsData.overview.frqSubmissions === 0)}
		<Card.Root
			class="rounded-2xl border border-dashed border-border/70 p-10 text-center text-muted-foreground shadow-sm ring-0"
		>
			<BookOpenIcon class="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
			<p class="font-medium">No practice sessions yet</p>
			<p class="mt-1 text-sm text-muted-foreground">Start practicing to see your stats here.</p>
			<div class="mt-4">
				<Button href={resolve('/app/practice')} class="rounded-full">Start Practicing</Button>
			</div>
		</Card.Root>
	{/if}
</PageShell>
