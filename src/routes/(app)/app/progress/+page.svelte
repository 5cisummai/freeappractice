<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import type { ProgressEntry, StatsData } from '$lib/types/user-stats.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import PageShell from '$lib/components/page-shell.svelte';
	import ProgressHistoryPanel from '$lib/components/progress/progress-history-panel.svelte';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import BarChart3Icon from '@lucide/svelte/icons/bar-chart-3';
	import FlameIcon from '@lucide/svelte/icons/flame';
	import TargetIcon from '@lucide/svelte/icons/target';
	import TrendingUpIcon from '@lucide/svelte/icons/trending-up';
	import HistoryIcon from '@lucide/svelte/icons/history';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import {
		appCard,
		appEmptyState,
		appPrimaryButton,
		appSectionTitle
	} from '$lib/app-ui.js';

	type ProgressView = 'mastery' | 'history';

	let { data } = $props();

	const progressData = $derived(data.progress as ProgressEntry[]);
	const statsData = $derived(data.stats as StatsData);

	let activeView = $state<ProgressView>(
		page.url.searchParams.get('view') === 'history' ? 'history' : 'mastery'
	);

	const grouped = $derived.by(() => {
		const map: Record<string, ProgressEntry[]> = {};
		for (const entry of progressData) {
			if (!map[entry.apClass]) map[entry.apClass] = [];
			map[entry.apClass].push(entry);
		}
		return Object.entries(map)
			.map(([apClass, units]) => ({
				apClass,
				units: [...units].sort((a, b) => a.mastery - b.mastery || b.totalAttempts - a.totalAttempts),
				avgMastery: Math.round(
					units.reduce((sum, unit) => sum + unit.mastery, 0) / Math.max(units.length, 1)
				),
				totalAttempts: units.reduce((sum, unit) => sum + unit.totalAttempts, 0)
			}))
			.sort((a, b) => a.apClass.localeCompare(b.apClass));
	});

	const hasActivity = $derived(
		(statsData?.overview.totalQuestions ?? 0) > 0 || grouped.length > 0
	);

	function masteryBarClass(mastery: number): string {
		if (mastery >= 75) return 'bg-emerald-500';
		if (mastery >= 50) return 'bg-amber-500';
		return 'bg-primary';
	}

	function practiceHref(apClass: string, unit?: string): string {
		const base = resolve('/app/practice');
		const params = new URLSearchParams({ apClass });
		if (unit) params.set('unit', unit);
		return `${base}?${params.toString()}`;
	}

	function syncViewToUrl(view: ProgressView) {
		const path = resolve('/app/progress');
		const next = view === 'history' ? `${path}?view=history` : path;
		const current = page.url.pathname + page.url.search;
		if (current !== next) {
			goto(next, { replaceState: true, keepFocus: true, noScroll: true });
		}
	}

	$effect(() => {
		const param = page.url.searchParams.get('view');
		activeView = param === 'history' ? 'history' : 'mastery';
	});

	$effect(() => {
		syncViewToUrl(activeView);
	});
</script>

<svelte:head>
	<title>Progress – Free AP Practice</title>
</svelte:head>

<PageShell
	title="Progress & History"
	description="Track mastery by subject and review every question you've answered."
>
	<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
		<Card.Root class="{appCard} p-4">
			<div class="flex items-center gap-3">
				<div class="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
					<BookOpenIcon class="size-4" />
				</div>
				<div>
					<p class="text-2xl font-semibold tracking-tight">{statsData.overview.totalQuestions}</p>
					<p class="text-xs text-muted-foreground">Questions</p>
				</div>
			</div>
		</Card.Root>
		<Card.Root class="{appCard} p-4">
			<div class="flex items-center gap-3">
				<div
					class="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
				>
					<TargetIcon class="size-4" />
				</div>
				<div>
					<p class="text-2xl font-semibold tracking-tight">{statsData.overview.accuracy}%</p>
					<p class="text-xs text-muted-foreground">Accuracy</p>
				</div>
			</div>
		</Card.Root>
		<Card.Root class="{appCard} p-4">
			<div class="flex items-center gap-3">
				<div
					class="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400"
				>
					<FlameIcon class="size-4" />
				</div>
				<div>
					<p class="text-2xl font-semibold tracking-tight">{statsData.overview.currentStreak}</p>
					<p class="text-xs text-muted-foreground">Day streak</p>
				</div>
			</div>
		</Card.Root>
		<Card.Root class="{appCard} p-4">
			<div class="flex items-center gap-3">
				<div
					class="flex size-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400"
				>
					<TrendingUpIcon class="size-4" />
				</div>
				<div>
					<p class="text-2xl font-semibold tracking-tight">
						{statsData.recentPerformance.questionsLast7Days}
					</p>
					<p class="text-xs text-muted-foreground">Last 7 days</p>
				</div>
			</div>
		</Card.Root>
	</div>

	<Tabs.Root bind:value={activeView} class="space-y-6">
		<Tabs.List class="grid w-full max-w-md grid-cols-2">
			<Tabs.Trigger value="mastery" class="flex items-center gap-2">
				<BarChart3Icon class="size-4" />
				Mastery
			</Tabs.Trigger>
			<Tabs.Trigger value="history" class="flex items-center gap-2">
				<HistoryIcon class="size-4" />
				Question history
			</Tabs.Trigger>
		</Tabs.List>

		<Tabs.Content value="mastery" class="space-y-6">
			{#if !hasActivity}
				<div class={appEmptyState}>
					<p>No progress yet. Go practice some questions!</p>
					<div class="mt-4">
						<Button href={resolve('/app/practice')} class={appPrimaryButton}>Start practicing</Button>
					</div>
				</div>
			{:else}
				{#if statsData.subjectBreakdown.length > 0}
					<section class="space-y-4">
						<h2 class={appSectionTitle}>Subject accuracy</h2>
						<Card.Root class={appCard}>
							<div class="divide-y divide-border/70">
								{#each statsData.subjectBreakdown as subject (subject.subject)}
									<div class="flex items-center gap-4 px-5 py-4">
										<div class="min-w-0 flex-1">
											<p class="truncate text-sm font-medium">{subject.subject}</p>
											<p class="text-xs text-muted-foreground">{subject.total} questions</p>
										</div>
										<div class="flex w-36 items-center gap-3">
											<div class="h-2 flex-1 overflow-hidden rounded-full bg-muted">
												<div
													class="h-full rounded-full transition-all {masteryBarClass(subject.accuracy)}"
													style="width: {subject.accuracy}%"
												></div>
											</div>
											<span class="w-10 text-right text-sm font-medium tabular-nums">
												{subject.accuracy}%
											</span>
										</div>
									</div>
								{/each}
							</div>
						</Card.Root>
					</section>
				{/if}

				{#if grouped.length > 0}
					<section class="space-y-4">
						<div class="flex flex-wrap items-end justify-between gap-3">
							<h2 class={appSectionTitle}>Mastery by unit</h2>
							<p class="text-sm text-muted-foreground">Sorted by lowest mastery first within each subject</p>
						</div>

						<div class="grid gap-4 lg:grid-cols-2">
							{#each grouped as subject (subject.apClass)}
								<Card.Root class="{appCard} flex flex-col">
									<Card.Header class="border-b border-border/60 pb-4">
										<div class="flex items-start justify-between gap-3">
											<div class="min-w-0">
												<Card.Title class="truncate text-base font-semibold tracking-tight">
													{subject.apClass}
												</Card.Title>
												<Card.Description>
													{subject.totalAttempts} attempts · {subject.avgMastery}% avg mastery
												</Card.Description>
											</div>
											<span
												class="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
											>
												{subject.units.length} unit{subject.units.length === 1 ? '' : 's'}
											</span>
										</div>
										<div class="mt-3 h-2 overflow-hidden rounded-full bg-muted">
											<div
												class="h-full rounded-full transition-all {masteryBarClass(subject.avgMastery)}"
												style="width: {subject.avgMastery}%"
											></div>
										</div>
									</Card.Header>
									<Card.Content class="space-y-4 pt-4">
										{#each subject.units as unit (`${subject.apClass}:${unit.unit || 'all-units'}`)}
											<div class="space-y-2">
												<div class="flex items-center justify-between gap-3">
													<div class="min-w-0">
														<p class="truncate text-sm font-medium">
															{unit.unit || 'All units'}
														</p>
														<p class="text-xs text-muted-foreground">
															{unit.totalAttempts} attempt{unit.totalAttempts === 1 ? '' : 's'}
														</p>
													</div>
													<span class="text-sm font-semibold tabular-nums">{unit.mastery}%</span>
												</div>
												<div class="h-2 overflow-hidden rounded-full bg-muted">
													<div
														class="h-full rounded-full transition-all {masteryBarClass(unit.mastery)}"
														style="width: {unit.mastery}%"
													></div>
												</div>
												<Button
													variant="ghost"
													size="sm"
													href={practiceHref(subject.apClass, unit.unit || undefined)}
													class="h-auto px-0 text-primary hover:bg-transparent"
												>
													Practice this unit
													<ArrowRightIcon class="size-3.5" />
												</Button>
											</div>
										{/each}
									</Card.Content>
								</Card.Root>
							{/each}
						</div>
					</section>
				{/if}
			{/if}
		</Tabs.Content>

		<Tabs.Content value="history" class="space-y-6">
			<ProgressHistoryPanel />
		</Tabs.Content>
	</Tabs.Root>
</PageShell>
