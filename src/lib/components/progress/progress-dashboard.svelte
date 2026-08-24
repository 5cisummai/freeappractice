<script lang="ts">
	import { resolve } from '$app/paths';
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import TargetIcon from '@lucide/svelte/icons/target';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Empty from '$lib/components/ui/empty/index.js';
	import * as Progress from '$lib/components/ui/progress/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import PageShell from '$lib/components/layout/page-shell.svelte';
	import type { HistoryItem, ProgressEntry, StatsData } from '$lib/users/types.js';
	import PracticeActivityDataTable from './practice-activity-data-table.svelte';
	import StackedProgressChart from './stacked-progress-chart.svelte';
	import {
		ALL_COURSES,
		accuracyByScope,
		availableCourses,
		filterHistory,
		filterProgress,
		hasPracticeActivity,
		nextFocusCopy,
		practiceHref,
		selectNextFocus,
		type CourseFilter
	} from './progress-metrics.js';

	let {
		stats,
		progress,
		historyItems,
		historyError = false,
		selectedSubjects = []
	}: {
		stats: StatsData;
		progress: ProgressEntry[];
		historyItems: HistoryItem[];
		historyError?: boolean;
		selectedSubjects?: string[];
	} = $props();

	let selectedCourse = $state<CourseFilter>(ALL_COURSES);

	const courses = $derived(availableCourses(progress, stats, selectedSubjects));
	const showCourseSelect = $derived(courses.length > 1);
	const courseHistory = $derived(filterHistory(historyItems, selectedCourse));
	const accuracyRows = $derived(accuracyByScope(courseHistory, selectedCourse));
	const nextFocus = $derived(selectNextFocus(filterProgress(progress, selectedCourse)));
	const nextFocusDetails = $derived(nextFocus ? nextFocusCopy(nextFocus) : null);
	const practiced = $derived(hasPracticeActivity(stats, progress));
	const selectedCourseLabel = $derived(
		selectedCourse === ALL_COURSES ? 'All courses' : selectedCourse
	);

	function handleCourseChange(value: string | undefined) {
		selectedCourse = value && value !== ALL_COURSES ? value : ALL_COURSES;
	}

	function accuracyMeterClass(accuracy: number): string {
		if (accuracy >= 80) return 'bg-emerald-500 dark:bg-emerald-400';
		if (accuracy >= 60) return 'bg-amber-500 dark:bg-amber-400';
		return 'bg-red-500 dark:bg-red-400';
	}
</script>

{#snippet courseSelect()}
	<Select.Root type="single" value={selectedCourse} onValueChange={handleCourseChange}>
		<Select.Trigger class="h-10 w-full min-w-48 sm:w-56" aria-label="Filter progress by course">
			{selectedCourseLabel}
		</Select.Trigger>
		<Select.Content>
			<Select.Group>
				<Select.Label>Courses</Select.Label>
				<Select.Item value={ALL_COURSES} label="All courses">All courses</Select.Item>
				{#each courses as course (course)}
					<Select.Item value={course} label={course}>{course}</Select.Item>
				{/each}
			</Select.Group>
		</Select.Content>
	</Select.Root>
{/snippet}

<PageShell title="Progress" description="See where you're strong and what to practice next.">
	{#snippet actions()}
		{#if showCourseSelect}
			<div class="hidden sm:block">{@render courseSelect()}</div>
		{/if}
	{/snippet}

	{#if showCourseSelect}
		<div class="sm:hidden">{@render courseSelect()}</div>
	{/if}

	{#if historyError}
		<Alert.Root>
			<CircleAlertIcon />
			<Alert.Title>We couldn't load your progress right now.</Alert.Title>
			<Alert.Description>Try refreshing the page.</Alert.Description>
		</Alert.Root>
	{/if}

	{#if !practiced}
		<Empty.Root class="border border-dashed">
			<Empty.Header>
				<Empty.Media variant="icon">
					<TargetIcon />
				</Empty.Media>
				<Empty.Title>Start practicing to see your progress here.</Empty.Title>
				<Empty.Description>
					Answer a few questions and your mastery and trends will show up on this page.
				</Empty.Description>
			</Empty.Header>
			<Empty.Content>
				<Button href={resolve('/app/practice')} class="w-full sm:w-auto">Start practicing</Button>
			</Empty.Content>
		</Empty.Root>
	{:else}
		<StackedProgressChart
			items={historyItems}
			course={selectedCourse}
			priorityLabels={selectedSubjects}
		/>

		<div class="grid gap-4 lg:grid-cols-2">
			<Card.Root class="h-full">
				<Card.Header>
					<Card.Title
						>{selectedCourse === ALL_COURSES ? 'Accuracy by class' : 'Accuracy by unit'}</Card.Title
					>
					<Card.Description>
						{selectedCourse === ALL_COURSES
							? 'Your accuracy across each class.'
							: `Your accuracy across the units in ${selectedCourse}.`}
					</Card.Description>
				</Card.Header>
				<Card.Content>
					{#if accuracyRows.length === 0}
						<p class="text-sm text-muted-foreground">No accuracy data yet.</p>
					{:else}
						<div class="space-y-5">
							{#each accuracyRows as row (row.label)}
								<div class="space-y-2">
									<div class="flex items-baseline justify-between gap-4">
										<span class="min-w-0 truncate text-sm font-medium">{row.label}</span>
										<span class="shrink-0 font-mono text-sm font-medium tabular-nums">
											{row.accuracy}%
										</span>
									</div>
									<Progress.Root
										value={row.accuracy}
										indicatorClass={accuracyMeterClass(row.accuracy)}
										aria-label={`${row.label} accuracy: ${row.accuracy}%`}
									/>
									<p class="text-xs text-muted-foreground">
										{row.correct} of {row.answered} correct
									</p>
								</div>
							{/each}
						</div>
					{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root class="h-full">
				<Card.Header>
					<Card.Title>Practice next</Card.Title>
					<Card.Description>A focused next step based on your recent progress.</Card.Description>
				</Card.Header>
				<Card.Content class="flex min-h-48 flex-col justify-between gap-6">
					{#if nextFocus && nextFocusDetails}
						<div class="space-y-3">
							<p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
								{nextFocus.kind === 'topic' ? 'Topic' : 'Unit'}
							</p>
							<div>
								<h3 class="font-display text-xl font-medium tracking-tight">
									{nextFocusDetails.heading}
								</h3>
								<p class="mt-1 text-sm text-muted-foreground">{nextFocusDetails.supporting}</p>
							</div>
							<p class="text-sm text-muted-foreground">
								{nextFocus.mastery}% mastery · {nextFocus.attempts} attempts
							</p>
						</div>
						<Button href={practiceHref(nextFocus.apClass, nextFocus.unit)}>
							Practice {nextFocus.topic ?? nextFocus.unit}
						</Button>
					{:else}
						<div>
							<h3 class="font-display text-xl font-medium tracking-tight">Choose your next unit</h3>
							<p class="mt-1 text-sm text-muted-foreground">
								Practice a few questions to create a focused recommendation.
							</p>
						</div>
						<Button href={resolve('/app/practice')}>Start practicing</Button>
					{/if}
				</Card.Content>
			</Card.Root>
		</div>

		<section class="flex flex-col gap-4" aria-labelledby="practice-activity-heading">
			<div class="flex flex-col gap-1">
				<h2 id="practice-activity-heading" class="font-display text-xl font-medium tracking-tight">
					Question history
				</h2>
			</div>
			{#if courseHistory.length === 0}
				<Empty.Root class="border border-dashed">
					<Empty.Header>
						<Empty.Title>No practice activity</Empty.Title>
						<Empty.Description>Your attempts will appear here.</Empty.Description>
					</Empty.Header>
				</Empty.Root>
			{:else}
				<PracticeActivityDataTable items={courseHistory} />
			{/if}
		</section>
	{/if}
</PageShell>
