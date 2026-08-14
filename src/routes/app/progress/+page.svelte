<script lang="ts">
	import { afterNavigate, goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import type { StatsData } from '$lib/users/types.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import PageShell from '$lib/components/layout/page-shell.svelte';
	import ProgressHistoryPanel from '$lib/components/history/progress-history-panel.svelte';
	import MasteryPanel from '$lib/components/progress/mastery-panel.svelte';
	import EmptyState from '$lib/components/app/empty-state.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	const targetImage = '/illustrations/target.png';

	type ProgressView = 'mastery' | 'history';

	let { data } = $props();
	let activeView = $state<ProgressView>(
		page.url.searchParams.get('view') === 'history' ? 'history' : 'mastery'
	);
	const statsData = $derived(data.stats as StatsData);

	const hasActivity = $derived(
		(data.stats?.overview.totalQuestions ?? 0) > 0 ||
			(data.stats?.overview.frqSubmissions ?? 0) > 0 ||
			(data.progress?.length ?? 0) > 0
	);
	const historySubjects = $derived(
		[
			...new Set([
				...(data.selectedSubjects ?? []),
				...(data.stats?.subjectBreakdown ?? []).map((subject) => subject.subject),
				...(data.progress ?? []).map((entry) => entry.apClass)
			])
		].sort((a, b) => a.localeCompare(b))
	);
	const historyUnits = $derived(
		(data.progress ?? []).map((entry) => ({ apClass: entry.apClass, unit: entry.unit }))
	);

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
		if (activeView !== nextView) activeView = nextView;
	});

	function formatStudyTime(hours: number): string {
		if (hours < 1) return `${Math.round(hours * 60)}m`;
		return `${hours.toFixed(1)}h`;
	}
</script>

<svelte:head>
	<title>Progress | Free AP Practice</title>
</svelte:head>

<PageShell title="Progress" description="See where you're strong and what to practice next.">
	<section class="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Progress summary">
		<Card.Root class="rounded-2xl border border-border/60 py-0 shadow-sm ring-0">
			<div class="p-4">
				<p class="text-xs font-medium text-sky-700 dark:text-sky-300">Questions answered</p>
				<p class="mt-1 text-2xl font-semibold text-sky-950 tabular-nums dark:text-sky-50">
					{statsData.overview.totalQuestions}
				</p>
			</div>
		</Card.Root>
		<Card.Root class="rounded-2xl border border-border/60 py-0 shadow-sm ring-0">
			<div class="p-4">
				<p class="text-xs font-medium text-emerald-700 dark:text-emerald-300">Accuracy</p>
				<p class="mt-1 text-2xl font-semibold text-emerald-950 tabular-nums dark:text-emerald-50">
					{statsData.overview.accuracy}%
				</p>
			</div>
		</Card.Root>
		<Card.Root class="rounded-2xl border border-border/60 py-0 shadow-sm ring-0">
			<div class="p-4">
				<p class="text-xs font-medium text-amber-700 dark:text-amber-300">Current streak</p>
				<p class="mt-1 text-2xl font-semibold text-amber-950 tabular-nums dark:text-amber-50">
					{statsData.overview.currentStreak} day{statsData.overview.currentStreak === 1 ? '' : 's'}
				</p>
			</div>
		</Card.Root>
		<Card.Root class="rounded-2xl border border-border/60 py-0 shadow-sm ring-0">
			<div class="p-4">
				<p class="text-xs font-medium text-violet-700 dark:text-violet-300">Study time</p>
				<p class="mt-1 text-2xl font-semibold text-violet-950 tabular-nums dark:text-violet-50">
					{formatStudyTime(statsData.overview.totalTimeHours)}
				</p>
			</div>
		</Card.Root>
	</section>

	<Tabs.Root bind:value={activeView} onValueChange={handleViewChange} class="space-y-6">
		<Tabs.List aria-label="Progress views" class="h-auto w-full max-w-md justify-start gap-1">
			<Tabs.Trigger value="mastery">Mastery</Tabs.Trigger>
			<Tabs.Trigger value="history">History</Tabs.Trigger>
		</Tabs.List>

		<Tabs.Content value="mastery" class="space-y-8">
			{#if !hasActivity}
				<EmptyState
					title="No progress yet"
					description="Practice a few questions to build this view."
					imageUrl={targetImage}
				>
					<Button href={resolve('/app/practice')}>Start practice</Button>
				</EmptyState>
			{:else}
				<MasteryPanel
					progress={data.progress}
					stats={data.stats}
					selectedSubjects={data.selectedSubjects}
				/>
			{/if}
		</Tabs.Content>

		<Tabs.Content value="history" class="space-y-6">
			<ProgressHistoryPanel subjects={historySubjects} units={historyUnits} />
		</Tabs.Content>
	</Tabs.Root>
</PageShell>
