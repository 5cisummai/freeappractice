<script lang="ts">
	import { BarChart } from 'layerchart';
	import { MediaQuery } from 'svelte/reactivity';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Chart from '$lib/components/ui/chart/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import type { HistoryItem } from '$lib/users/types.js';
	import AccuracyOverTimeChart from './accuracy-over-time-chart.svelte';
	import {
		ALL_COURSES,
		buildAccuracyDays,
		filterHistory,
		stackedActivityByScope,
		type CourseFilter
	} from './progress-insights.js';

	let {
		items,
		course,
		priorityLabels = [],
		loading = false
	}: {
		items: HistoryItem[];
		course: CourseFilter;
		priorityLabels?: string[];
		loading?: boolean;
	} = $props();

	const ranges = [
		{ value: '7', label: 'Last week', days: 7 },
		{ value: '30', label: 'Last 30 days', days: 30 },
		{ value: '90', label: 'Last 3 months', days: 90 }
	] as const;
	type RangeValue = (typeof ranges)[number]['value'];
	let selectedRange = $state<RangeValue>('30');
	let activeView = $state('activity');

	const reducedMotion = new MediaQuery('(prefers-reduced-motion: reduce)');
	const colors = [
		'var(--primary)',
		'var(--chart-2)',
		'var(--chart-3)',
		'var(--chart-4)',
		'var(--chart-5)',
		'var(--chart-6)',
		'var(--chart-7)',
		'var(--chart-8)'
	];
	const rangeDays = $derived(ranges.find((range) => range.value === selectedRange)?.days ?? 30);
	const rangeLabel = $derived(
		ranges.find((range) => range.value === selectedRange)?.label ?? 'Last 30 days'
	);
	const activity = $derived(stackedActivityByScope(items, course, rangeDays, priorityLabels));
	const accuracyDays = $derived(buildAccuracyDays(filterHistory(items, course), rangeDays));
	const series = $derived(
		activity.series.map((item) => ({
			...item,
			color: item.label === 'Other' ? 'var(--muted-foreground)' : colorForLabel(item.label)
		}))
	);
	const chartConfig = $derived(
		Object.fromEntries(series.map((item) => [item.key, { label: item.label, color: item.color }]))
	);
	const rows = $derived(activity.rows);
	const hasActivity = $derived(rows.some((row) => row.total > 0));
	const isAllCourses = $derived(course === ALL_COURSES);
	const title = $derived(isAllCourses ? 'Practice by class' : 'Practice by unit');
	const description = $derived(
		isAllCourses
			? 'Your daily practice across all classes.'
			: `Your daily practice across ${course}.`
	);

	function handleRangeChange(value: string | undefined): void {
		const nextRange = ranges.find((range) => range.value === value);
		if (nextRange) selectedRange = nextRange.value;
	}

	function colorForLabel(label: string): string {
		let hash = 0;
		for (const character of label) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
		return colors[hash % colors.length] ?? colors[0] ?? 'var(--primary)';
	}
	function formatDay(dayKey: string): string {
		const [year, month, day] = dayKey.split('-').map(Number);
		return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<Tabs.Root bind:value={activeView} class="w-full gap-4">
	<div class="flex min-w-0 flex-row items-center justify-between gap-2">
		<Tabs.List aria-label="Progress charts" class="shrink-0">
			<Tabs.Trigger value="activity" class="px-2">Practice</Tabs.Trigger>
			<Tabs.Trigger value="accuracy" class="px-2">Accuracy</Tabs.Trigger>
		</Tabs.List>
		<Select.Root type="single" value={selectedRange} onValueChange={handleRangeChange}>
			<Select.Trigger class="w-32 shrink-0" aria-label="Select chart time range">
				{rangeLabel}
			</Select.Trigger>
			<Select.Content>
				<Select.Group>
					<Select.Label>Time range</Select.Label>
					{#each ranges as range (range.value)}
						<Select.Item value={range.value} label={range.label}>{range.label}</Select.Item>
					{/each}
				</Select.Group>
			</Select.Content>
		</Select.Root>
	</div>

	<Tabs.Content value="activity" class="mt-0">
		<Card.Root>
			<Card.Header>
				<Card.Title>{title}</Card.Title>
				<Card.Description>{description} {rangeLabel}.</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if loading}
					<div class="h-80 w-full animate-pulse rounded-lg bg-muted" aria-hidden="true"></div>
				{:else if series.length === 0 || !hasActivity}
					<div class="flex min-h-48 items-center justify-center rounded-lg border border-dashed">
						<p class="text-sm text-muted-foreground">
							No practice activity in {rangeLabel.toLowerCase()}.
						</p>
					</div>
				{:else}
					<Chart.Container config={chartConfig} class="aspect-auto h-80 w-full">
						<BarChart
							data={rows}
							x="dayKey"
							{series}
							seriesLayout="stack"
							bandPadding={0.3}
							stackPadding={1}
							axis="x"
							grid={{ y: { stroke: 'var(--border)', strokeWidth: 1, opacity: 0.6 } }}
							rule={false}
							highlight={false}
							props={{
								xAxis: { format: formatDay, tickSpacing: 56 },
								bars: {
									stroke: 'none',
									radius: 4,
									...(reducedMotion.current ? {} : { motion: 'tween' as const })
								}
							}}
						>
							{#snippet tooltip()}
								<Chart.Tooltip labelFormatter={(value) => formatDay(String(value))} />
							{/snippet}
						</BarChart>
					</Chart.Container>
				{/if}
			</Card.Content>
		</Card.Root>
	</Tabs.Content>

	<Tabs.Content value="accuracy" class="mt-0">
		<AccuracyOverTimeChart days={accuracyDays} />
	</Tabs.Content>
</Tabs.Root>
