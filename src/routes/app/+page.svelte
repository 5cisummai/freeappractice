<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ProgressEntry, StatsData } from '$lib/users/types.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import FlameIcon from '@lucide/svelte/icons/flame';
	import TrendingUpIcon from '@lucide/svelte/icons/trending-up';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import PageShell from '$lib/components/layout/page-shell.svelte';
	import RichStatsGrid from '$lib/components/app/rich-stats-grid.svelte';
	import SectionHeader from '$lib/components/app/section-header.svelte';
	import SubjectRow from '$lib/components/app/subject-row.svelte';
	import { appSurfaceClass } from '$lib/components/app/surface.js';

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

	const greeting = $derived.by(() => {
		const hour = new Date().getHours();
		if (hour < 12) return 'Good morning';
		if (hour < 17) return 'Good afternoon';
		return 'Good evening';
	});

	const heroMastery = $derived.by(() => {
		if (!nextBestUnit) return 0;
		if (frqRecommendation) return nextBestUnit.frqAveragePercentage ?? 0;
		if (nextBestUnit.totalAttempts > 0) return nextBestUnit.mastery;
		return nextBestUnit.frqAveragePercentage ?? 0;
	});

	const recentActivity = $derived.by(() => {
		return [...progressData]
			.filter((entry) => entry.lastAttemptAt || entry.frqLastAttemptAt)
			.map((entry) => {
				const lastAt = [entry.lastAttemptAt, entry.frqLastAttemptAt]
					.filter(Boolean)
					.sort((a, b) => String(b).localeCompare(String(a)))[0];
				const score =
					entry.totalAttempts > 0
						? entry.mastery
						: (entry.frqAveragePercentage ?? null);
				return { ...entry, lastAt, score };
			})
			.sort((a, b) => String(b.lastAt).localeCompare(String(a.lastAt)))
			.slice(0, 5);
	});

	const accuracyDelta = $derived.by(() => {
		const overall = statsData?.overview.accuracy ?? 0;
		const recent = statsData?.recentPerformance.accuracyLast7Days ?? 0;
		if (!statsData?.recentPerformance.questionsLast7Days) return null;
		return recent - overall;
	});

	function masteryBarClass(mastery: number): string {
		if (mastery >= 75) return 'bg-emerald-500';
		if (mastery >= 50) return 'bg-amber-500';
		return 'bg-primary';
	}
</script>

<svelte:head>
	<title>Home – Free AP Practice</title>
</svelte:head>

<PageShell
	title={`${greeting}, ${firstName}`}
	description="Let's keep your momentum going."
	maskTitle
>
	{#snippet actions()}
		{#if (statsData?.overview.currentStreak ?? 0) > 0}
			<span
				class="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs font-medium shadow-sm"
			>
				<FlameIcon class="size-3.5 text-amber-500" />
				{statsData.overview.currentStreak} day streak
			</span>
		{/if}
		{#if accuracyDelta !== null}
			<span
				class="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs font-medium shadow-sm"
			>
				<TrendingUpIcon class="size-3.5 text-primary" />
				{#if accuracyDelta > 0}+{/if}{accuracyDelta}% vs overall
			</span>
		{/if}
	{/snippet}

	<!-- Hero -->
	<Card.Root
		class="relative overflow-hidden rounded-2xl border-0 bg-gradient-to-br from-primary via-primary to-primary/80 p-6 text-primary-foreground shadow-md ring-0 sm:p-8"
	>
		<div
			class="pointer-events-none absolute -right-8 -top-8 size-40 rounded-full bg-white/10 blur-2xl"
			aria-hidden="true"
		></div>
		<div
			class="pointer-events-none absolute -bottom-10 right-16 size-32 rounded-full bg-white/10 blur-xl"
			aria-hidden="true"
		></div>
		<div class="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
			<div class="min-w-0 flex-1 space-y-3">
				<p class="text-sm font-medium text-primary-foreground/80">Continue where you left off</p>
				{#if nextBestUnit}
					<h2 class="font-display text-2xl font-medium tracking-tight sm:text-3xl">
						{nextBestUnit.apClass}
					</h2>
					{#if nextBestUnit.unit}
						<p class="text-sm text-primary-foreground/85">{nextBestUnit.unit}</p>
					{/if}
					<div class="max-w-sm space-y-1.5 pt-1">
						<div class="flex items-center justify-between text-xs text-primary-foreground/80">
							<span>{heroMastery}% mastered</span>
							<span>
								{#if frqRecommendation}
									FRQ · {nextBestUnit.frqAttempts ?? 0} submissions
								{:else if nextBestUnit.totalAttempts > 0}
									{nextBestUnit.totalAttempts} attempts
								{:else}
									FRQ · {nextBestUnit.frqAttempts ?? 0} submissions
								{/if}
							</span>
						</div>
						<div class="h-2 overflow-hidden rounded-full bg-white/20">
							<div
								class="h-full rounded-full bg-white transition-all"
								style="width: {heroMastery}%"
							></div>
						</div>
					</div>
				{:else}
					<h2 class="font-display text-2xl font-medium tracking-tight sm:text-3xl">
						Start your first focused practice
					</h2>
					<p class="max-w-md text-sm text-primary-foreground/85">
						We'll personalize this recommendation once you complete a few attempts.
					</p>
				{/if}
				<div class="pt-2">
					<Button
						href={recommendedPracticeHref}
						variant="secondary"
						class="rounded-full bg-white text-primary hover:bg-white/90"
					>
						Continue practice
						<ArrowRightIcon class="size-4" />
					</Button>
				</div>
			</div>
			<div
				class="hidden shrink-0 items-center justify-center sm:flex"
				aria-hidden="true"
			>
				<div
					class="flex size-28 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20"
				>
					<BookOpenIcon class="size-12 text-white/90" />
				</div>
			</div>
		</div>
	</Card.Root>

	{#if (statsData?.overview.totalQuestions ?? 0) > 0 || (frqEnabled && (statsData?.overview.frqSubmissions ?? 0) > 0)}
		<RichStatsGrid stats={statsData} {frqEnabled} />
	{/if}

	{#if statsData?.subjectBreakdown && statsData.subjectBreakdown.length > 0}
		<div>
			<SectionHeader title="Your subjects">
				{#snippet action()}
					<a
						href={resolve('/app/progress')}
						class="text-sm text-primary underline-offset-4 hover:underline"
					>
						View progress
					</a>
				{/snippet}
			</SectionHeader>
			<Card.Root class={appSurfaceClass}>
				<div class="divide-y divide-border/70">
					{#each statsData.subjectBreakdown as subject (subject.subject)}
						<SubjectRow
							title={subject.subject}
							meta={`${subject.total} questions${subject.avgTimeSeconds ? ` · ${Math.round(subject.avgTimeSeconds)}s avg` : ''}`}
							value={subject.total > 0 ? `${subject.accuracy}%` : undefined}
							barWidth={subject.accuracy}
							barClass={masteryBarClass(subject.accuracy)}
						/>
					{/each}
				</div>
			</Card.Root>
		</div>
	{/if}

	{#if recentActivity.length > 0}
		<div>
			<SectionHeader title="Recent activity">
				{#snippet action()}
					<a
						href="{resolve('/app/progress')}?view=history"
						class="text-sm text-primary underline-offset-4 hover:underline"
					>
						Full history
					</a>
				{/snippet}
			</SectionHeader>
			<Card.Root class={appSurfaceClass}>
				<div class="divide-y divide-border/70">
					{#each recentActivity as entry (`${entry.apClass}:${entry.unit}`)}
						<div class="flex items-center justify-between gap-4 px-5 py-3.5">
							<div class="min-w-0">
								<p class="truncate text-sm font-medium">
									{entry.apClass}{#if entry.unit}
										· {entry.unit}{/if}
								</p>
								<p class="text-xs text-muted-foreground">
									{entry.totalAttempts} MCQ{#if entry.frqAttempts}
										· {entry.frqAttempts} FRQ{/if}
								</p>
							</div>
							{#if entry.score !== null}
								<span
									class="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold tabular-nums text-primary"
								>
									{entry.score}%
								</span>
							{/if}
						</div>
					{/each}
				</div>
			</Card.Root>
		</div>
	{/if}

	{#if !statsData || (statsData.overview.totalQuestions === 0 && statsData.overview.frqSubmissions === 0)}
		<Card.Root class="{appSurfaceClass} border-dashed p-10 text-center text-muted-foreground">
			<BookOpenIcon class="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
			<p class="font-medium">No practice sessions yet</p>
			<p class="mt-1 text-sm text-muted-foreground">Start practicing to see your stats here.</p>
			<div class="mt-4">
				<Button href={resolve('/app/practice')} class="rounded-full">Start practicing</Button>
			</div>
		</Card.Root>
	{/if}
</PageShell>
