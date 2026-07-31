<script lang="ts">
	import { afterNavigate, goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import type { ProgressEntry, StatsData } from '$lib/users/types.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import PageShell from '$lib/components/layout/page-shell.svelte';
	import ProgressHistoryPanel from '$lib/components/history/progress-history-panel.svelte';
	import RichStatsGrid from '$lib/components/app/rich-stats-grid.svelte';
	import InsightList from '$lib/components/app/insight-list.svelte';
	import ConsistencySparkline from '$lib/components/app/consistency-sparkline.svelte';
	import SectionHeader from '$lib/components/app/section-header.svelte';
	import { appSurfaceClass } from '$lib/components/app/surface.js';
	import BarChart3Icon from '@lucide/svelte/icons/bar-chart-3';
	import HistoryIcon from '@lucide/svelte/icons/history';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';

	type ProgressView = 'mastery' | 'history';

	let { data } = $props();

	const progressData = $derived(data.progress as ProgressEntry[]);
	const statsData = $derived(data.stats as StatsData);
	const frqEnabled = $derived(Boolean(data.frqEnabled));

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
				units: [...units].sort(
					(a, b) =>
						(a.totalAttempts ? a.mastery : 101) - (b.totalAttempts ? b.mastery : 101) ||
						b.totalAttempts - a.totalAttempts
				),
				avgMastery: (() => {
					const mcqUnits = units.filter((unit) => unit.totalAttempts > 0);
					return mcqUnits.length
						? Math.round(mcqUnits.reduce((sum, unit) => sum + unit.mastery, 0) / mcqUnits.length)
						: null;
				})(),
				totalAttempts: units.reduce((sum, unit) => sum + unit.totalAttempts, 0)
			}))
			.sort((a, b) => a.apClass.localeCompare(b.apClass));
	});

	const hasActivity = $derived(
		(statsData?.overview.totalQuestions ?? 0) > 0 ||
			(statsData?.overview.frqSubmissions ?? 0) > 0 ||
			grouped.length > 0
	);

	const rankedSubjects = $derived.by(() => {
		return (statsData?.subjectBreakdown ?? [])
			.filter((s) => s.total > 0)
			.map((s) => ({ label: s.subject, accuracy: s.accuracy }))
			.sort((a, b) => b.accuracy - a.accuracy);
	});

	const strengths = $derived(
		rankedSubjects.slice(0, 3).map((s) => ({ label: s.label, value: `${s.accuracy}%` }))
	);
	const needsImprovement = $derived(
		[...rankedSubjects]
			.reverse()
			.slice(0, 3)
			.map((s) => ({ label: s.label, value: `${s.accuracy}%` }))
	);

	function masteryBarClass(mastery: number): string {
		if (mastery >= 75) return 'bg-emerald-500';
		if (mastery >= 50) return 'bg-amber-500';
		return 'bg-primary';
	}

	function practiceHref(apClass: string, unit: string | undefined = undefined): string {
		const base = resolve('/app/practice');
		const classParam = `apClass=${encodeURIComponent(apClass)}`;
		const unitParam = unit ? `&unit=${encodeURIComponent(unit)}` : '';
		return `${base}?${classParam}${unitParam}`;
	}

	function syncViewToUrl(view: ProgressView) {
		const path = resolve('/app/progress');
		const next = view === 'history' ? `${path}?view=history` : path;
		const current = page.url.pathname + page.url.search;
		if (current !== next) {
			goto(resolve(view === 'history' ? '/app/progress?view=history' : '/app/progress'), {
				replaceState: true,
				keepFocus: true,
				noScroll: true
			});
		}
	}

	function handleViewChange(view: string | undefined) {
		if (view !== 'mastery' && view !== 'history') return;
		activeView = view;
		syncViewToUrl(view);
	}

	afterNavigate(() => {
		const param = page.url.searchParams.get('view');
		const nextView: ProgressView = param === 'history' ? 'history' : 'mastery';
		if (activeView !== nextView) {
			activeView = nextView;
		}
	});
</script>

<svelte:head>
	<title>Progress – Free AP Practice</title>
</svelte:head>

<PageShell
	title="Progress & History"
	description="Track mastery by subject and review every question you've answered."
>
	{#if hasActivity}
		<RichStatsGrid stats={statsData} {frqEnabled} />
	{/if}

	<Tabs.Root bind:value={activeView} onValueChange={handleViewChange} class="space-y-6">
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
				<div
					class="rounded-2xl border border-dashed border-border/70 p-12 text-center text-muted-foreground"
				>
					<p>No progress yet. Go practice some questions!</p>
					<div class="mt-4">
						<Button href={resolve('/app/practice')} class="rounded-full">Start practicing</Button>
					</div>
				</div>
			{:else}
				<div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
					<div class="space-y-6 min-w-0">
						{#if statsData.subjectBreakdown.length > 0}
							<section class="space-y-4">
								<SectionHeader title="Subject mastery" />
								<Card.Root class={appSurfaceClass}>
									<div class="overflow-x-auto">
										<table class="w-full min-w-[480px] text-left text-sm">
											<thead>
												<tr class="border-b border-border/70 text-xs text-muted-foreground">
													<th class="px-5 py-3 font-medium">Subject</th>
													<th class="px-3 py-3 font-medium">Units</th>
													<th class="px-3 py-3 font-medium">Progress</th>
													<th class="px-3 py-3 font-medium">Questions</th>
													<th class="px-5 py-3 font-medium text-right">Accuracy</th>
												</tr>
											</thead>
											<tbody class="divide-y divide-border/70">
												{#each statsData.subjectBreakdown as subject (subject.subject)}
													{@const unitCount =
														grouped.find((g) => g.apClass === subject.subject)?.units.length ?? 0}
													<tr>
														<td class="px-5 py-3.5 font-medium">{subject.subject}</td>
														<td class="px-3 py-3.5 text-muted-foreground">{unitCount}</td>
														<td class="px-3 py-3.5">
															{#if subject.total > 0}
																<div class="h-2 w-28 overflow-hidden rounded-full bg-muted">
																	<div
																		class="h-full rounded-full transition-all {masteryBarClass(
																			subject.accuracy
																		)}"
																		style="width: {subject.accuracy}%"
																	></div>
																</div>
															{:else}
																<span class="text-muted-foreground">—</span>
															{/if}
														</td>
														<td class="px-3 py-3.5 tabular-nums text-muted-foreground">
															{subject.total}
														</td>
														<td class="px-5 py-3.5 text-right font-semibold tabular-nums">
															{#if subject.total > 0}
																{subject.accuracy}%
															{:else}
																—
															{/if}
														</td>
													</tr>
												{/each}
											</tbody>
										</table>
									</div>
								</Card.Root>
							</section>
						{/if}

						{#if grouped.length > 0}
							<section class="space-y-4">
								<div class="flex flex-wrap items-end justify-between gap-3">
									<h2 class="font-display text-xl font-medium tracking-tight sm:text-2xl">
										Mastery by unit
									</h2>
									<p class="text-sm text-muted-foreground">
										Sorted by lowest mastery first within each subject
									</p>
								</div>

								<div class="grid gap-4 lg:grid-cols-2">
									{#each grouped as subject (subject.apClass)}
										<Card.Root class="flex flex-col {appSurfaceClass}">
											<Card.Header class="border-b border-border/60 pb-4">
												<div class="flex items-start justify-between gap-3">
													<div class="min-w-0">
														<Card.Title class="truncate text-base font-semibold tracking-tight">
															{subject.apClass}
														</Card.Title>
														<Card.Description>
															{#if subject.avgMastery !== null}
																{subject.totalAttempts} attempts · {subject.avgMastery}% avg MCQ
																mastery
															{:else}
																FRQ performance is tracked separately
															{/if}
														</Card.Description>
													</div>
													<span
														class="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
													>
														{subject.units.length} unit{subject.units.length === 1 ? '' : 's'}
													</span>
												</div>
												{#if subject.avgMastery !== null}
													<div class="mt-3 h-2 overflow-hidden rounded-full bg-muted">
														<div
															class="h-full rounded-full transition-all {masteryBarClass(
																subject.avgMastery
															)}"
															style="width: {subject.avgMastery}%"
														></div>
													</div>
												{/if}
											</Card.Header>
											<Card.Content class="space-y-4 pt-4">
												{#each subject.units as unit (`${subject.apClass}:${unit.unit || 'all-units'}`)}
													<div class="space-y-2">
														<div class="flex items-center justify-between gap-3">
															<div class="min-w-0">
																<p class="truncate text-sm font-medium">
																	{unit.unit || 'All units'}
																</p>
																{#if unit.totalAttempts > 0}
																	<p class="text-xs text-muted-foreground">
																		{unit.totalAttempts} attempt{unit.totalAttempts === 1
																			? ''
																			: 's'}
																	</p>
																{:else}
																	<p class="text-xs text-muted-foreground">No MCQ attempts</p>
																{/if}
																{#if unit.frqAttempts}
																	<p class="text-xs text-muted-foreground">
																		{unit.frqAttempts} FRQ · {unit.frqAveragePercentage}% average
																	</p>
																{/if}
															</div>
															{#if unit.totalAttempts > 0}
																<span class="text-sm font-semibold tabular-nums"
																	>{unit.mastery}%</span
																>
															{/if}
														</div>
														{#if unit.totalAttempts > 0}
															<div class="h-2 overflow-hidden rounded-full bg-muted">
																<div
																	class="h-full rounded-full transition-all {masteryBarClass(
																		unit.mastery
																	)}"
																	style="width: {unit.mastery}%"
																></div>
															</div>
														{/if}
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
					</div>

					<aside class="space-y-4 lg:sticky lg:top-20 lg:self-start">
						<InsightList title="Strengths" items={strengths} tone="strength" />
						<InsightList title="Needs improvement" items={needsImprovement} tone="needs" />
						<ConsistencySparkline values={statsData.questionsPerDayLast7Days ?? []} />
					</aside>
				</div>
			{/if}
		</Tabs.Content>

		<Tabs.Content value="history" class="space-y-6">
			<ProgressHistoryPanel />
		</Tabs.Content>
	</Tabs.Root>
</PageShell>
