<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ProgressEntry, StatsData } from '$lib/users/types.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import PageShell from '$lib/components/layout/page-shell.svelte';
	import StatsOverviewCards from '$lib/components/stats-overview-cards.svelte';
	import {
		performanceBarClass,
		performanceTextClass
	} from '$lib/components/app/performance.js';
	import { cn } from '$lib/utils.js';

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

	const hasStats = $derived(
		(statsData?.overview.totalQuestions ?? 0) > 0 ||
			(frqEnabled && (statsData?.overview.frqSubmissions ?? 0) > 0)
	);

	const heroScore = $derived.by(() => {
		if (!nextBestUnit) return null;
		if (frqRecommendation) return nextBestUnit.frqAveragePercentage ?? 0;
		if (nextBestUnit.totalAttempts > 0) return nextBestUnit.mastery;
		return nextBestUnit.frqAveragePercentage ?? 0;
	});

	function formatAvgDuration(totalSeconds: number): string {
		const seconds = Math.max(0, Math.round(totalSeconds));
		const minutes = Math.floor(seconds / 60);
		const remainder = seconds % 60;
		if (minutes === 0) return `${remainder}s avg`;
		if (remainder === 0) return `${minutes}m avg`;
		return `${minutes}m ${remainder}s avg`;
	}
</script>

<svelte:head>
	<title>Dashboard – Free AP Practice</title>
</svelte:head>

<PageShell
	title={`Welcome back, ${firstName}`}
	description="Pick up where you left off, or check how you're doing."
	maskTitle
>
	<!-- Primary focus: next practice action -->
	<Card.Root
		class="rounded-2xl border border-primary/35 bg-primary/5 p-5 shadow-sm ring-0 sm:p-6"
	>
		<div class="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
			<div class="min-w-0 space-y-2">
				<p class="text-sm font-medium text-primary">Next up</p>
				{#if nextBestUnit}
					<h2 class="font-display text-2xl font-medium tracking-tight sm:text-3xl">
						{nextBestUnit.apClass}
					</h2>
					{#if nextBestUnit.unit}
						<p class="text-sm text-muted-foreground">{nextBestUnit.unit}</p>
					{/if}
					{#if heroScore !== null}
						<p class={cn('text-sm font-medium tabular-nums', performanceTextClass(heroScore))}>
							{#if frqRecommendation}
								FRQ {heroScore}% · {nextBestUnit.frqAttempts ?? 0} submissions
							{:else if nextBestUnit.totalAttempts > 0}
								{heroScore}% mastery · {nextBestUnit.totalAttempts} attempts
							{:else}
								FRQ {heroScore}% · {nextBestUnit.frqAttempts ?? 0} submissions
							{/if}
						</p>
					{/if}
				{:else}
					<h2 class="font-display text-2xl font-medium tracking-tight sm:text-3xl">
						Start a focused practice session
					</h2>
					<p class="max-w-md text-sm text-muted-foreground">
						This picks a weak unit once you have a few attempts.
					</p>
				{/if}
			</div>
			<Button href={recommendedPracticeHref} size="lg" class="shrink-0">
				{nextBestUnit ? 'Continue practice' : 'Start practice'}
				<ArrowRightIcon class="size-4" />
			</Button>
		</div>
	</Card.Root>

	{#if hasStats}
		<div class="space-y-3">
			<div class="flex flex-wrap items-end justify-between gap-2">
				<h2 class="font-display text-xl font-medium tracking-tight sm:text-2xl">Overview</h2>
				<a
					href="{resolve('/app/progress')}?view=history"
					class="text-sm text-primary underline-offset-4 hover:underline"
				>
					Question history
				</a>
			</div>
			<StatsOverviewCards stats={statsData} {frqEnabled} />
		</div>
	{/if}

	<!-- Secondary paths -->
	<div>
		<h2 class="mb-3 text-sm font-medium text-muted-foreground">Also</h2>
		<div class="grid gap-3 sm:grid-cols-2">
			<a
				href={resolve('/app/practice')}
				class="group flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card px-5 py-4 shadow-sm transition-colors hover:border-primary/30 hover:bg-primary/5"
			>
				<div>
					<p class="font-medium">Practice</p>
					<p class="text-sm text-muted-foreground">Generate a question and check your answer</p>
				</div>
				<ArrowRightIcon
					class="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
				/>
			</a>
			<a
				href={resolve('/app/progress')}
				class="group flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card px-5 py-4 shadow-sm transition-colors hover:border-border hover:bg-muted/40"
			>
				<div>
					<p class="font-medium">Progress</p>
					<p class="text-sm text-muted-foreground">See mastery by subject and unit</p>
				</div>
				<ArrowRightIcon
					class="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
				/>
			</a>
		</div>
	</div>

	{#if statsData?.subjectBreakdown && statsData.subjectBreakdown.length > 0}
		<div>
			<div class="mb-4 flex flex-wrap items-end justify-between gap-2">
				<h2 class="font-display text-xl font-medium tracking-tight sm:text-2xl">
					Subject performance
				</h2>
				<a
					href={resolve('/app/progress')}
					class="text-sm text-primary underline-offset-4 hover:underline"
				>
					Full progress
				</a>
			</div>
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
											class={cn(
												'h-full rounded-full transition-all',
												performanceBarClass(subject.accuracy)
											)}
											style="width: {subject.accuracy}%"
										></div>
									</div>
								</div>
								<span
									class={cn(
										'w-12 text-sm font-semibold tabular-nums',
										performanceTextClass(subject.accuracy)
									)}
								>
									{subject.accuracy}%
								</span>
							</div>
							{#if subject.avgTimeSeconds}
								<div class="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
									<ClockIcon class="h-3 w-3" />
									<span>{formatAvgDuration(subject.avgTimeSeconds)}</span>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</Card.Root>
		</div>
	{/if}

	{#if !hasStats}
		<Card.Root
			class="rounded-2xl border border-dashed border-border/70 p-8 text-center shadow-sm ring-0 sm:p-10"
		>
			<p class="font-medium">No practice yet</p>
			<p class="mt-1 text-sm text-muted-foreground">Answer a few questions to unlock your overview.</p>
			<div class="mt-4">
				<Button href={resolve('/app/practice')}>Start practice</Button>
			</div>
		</Card.Root>
	{/if}
</PageShell>
