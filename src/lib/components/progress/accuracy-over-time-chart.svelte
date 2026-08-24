<script lang="ts">
	import { scaleBand } from 'd3-scale';
	import { curveLinear } from 'd3-shape';
	import { BarChart, LineChart } from 'layerchart';
	import { MediaQuery } from 'svelte/reactivity';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Chart from '$lib/components/ui/chart/index.js';
	import * as Empty from '$lib/components/ui/empty/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { resolve } from '$app/paths';
	import ChartHoverTooltip from './chart-hover-tooltip.svelte';
	import type { AccuracyDay } from './progress-metrics.js';
	import { accuracyDayCount } from './progress-metrics.js';

	type AccuracyBarDay = AccuracyDay & { wrong: number };

	let { days }: { days: AccuracyDay[] } = $props();

	const reducedMotion = new MediaQuery('(prefers-reduced-motion: reduce)');
	const chartConfig = {
		accuracy: { label: 'Accuracy', color: 'var(--primary)' },
		correct: { label: 'Correct', color: 'var(--chart-8)' },
		wrong: { label: 'Wrong', color: 'var(--destructive)' }
	} satisfies Chart.ChartConfig;

	const ready = $derived(accuracyDayCount(days) >= 2);
	const accuracyBars = $derived(
		days.map((day) => ({ ...day, wrong: Math.max(0, day.answered - day.correct) }))
	);
	const accuracyXScale = scaleBand<string>().padding(0.3);

	function isDefined(d: AccuracyDay): boolean {
		return d.accuracy !== null;
	}

	function formatDayKey(value: string): string {
		const [year, month, day] = value.split('-').map(Number);
		return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>Accuracy</Card.Title>
		<Card.Description>Correct and wrong questions by day.</Card.Description>
	</Card.Header>
	<Card.Content>
		{#if !ready}
			<Empty.Root class="min-h-48 border-0 p-6">
				<Empty.Header>
					<Empty.Title>Practice more to see your accuracy.</Empty.Title>
					<Empty.Description>
						Answer questions on at least two days to see your accuracy chart.
					</Empty.Description>
				</Empty.Header>
				<Empty.Content>
					<Button href={resolve('/app/practice')}>Start practicing</Button>
				</Empty.Content>
			</Empty.Root>
		{:else}
			<div class="space-y-3">
				<div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
					<span class="inline-flex items-center gap-1.5">
						<span class="size-2 rounded-full bg-chart-8"></span>
						Correct
					</span>
					<span class="inline-flex items-center gap-1.5">
						<span class="size-2 rounded-full bg-destructive"></span>
						Wrong
					</span>
					<span class="inline-flex items-center gap-1.5">
						<span class="h-0.5 w-3 rounded-full bg-primary"></span>
						Accuracy
					</span>
				</div>
				<Chart.Container config={chartConfig} class="relative aspect-auto h-80 w-full">
					<div class="absolute inset-0">
						<BarChart
							class="h-full w-full"
							data={accuracyBars}
							x="dayKey"
							xScale={accuracyXScale}
							series={[
								{ key: 'correct', label: 'Correct', color: chartConfig.correct.color },
								{ key: 'wrong', label: 'Wrong', color: chartConfig.wrong.color }
							]}
							seriesLayout="stack"
							bandPadding={0.3}
							stackPadding={1}
							axis="x"
							grid={{ y: { stroke: 'var(--border)', strokeWidth: 1, opacity: 0.6 } }}
							rule={false}
							highlight={false}
							props={{
								xAxis: { format: formatDayKey, tickSpacing: 56 },
								bars: {
									stroke: 'none',
									radius: 4,
									...(reducedMotion.current ? {} : { motion: 'tween' as const })
								}
							}}
						>
							{#snippet tooltip()}
								<ChartHoverTooltip>
									{#snippet children({ data })}
										{@const row = data as AccuracyBarDay | undefined}
										{#if row}
											<div class="font-medium">
												{row.date.toLocaleDateString(undefined, {
													month: 'short',
													day: 'numeric',
													year: 'numeric'
												})}
											</div>
											<div class="flex items-center justify-between gap-4">
												<span class="text-muted-foreground">Accuracy</span>
												<span class="font-mono font-medium tabular-nums">
													{row.accuracy === null ? '—' : `${row.accuracy}%`}
												</span>
											</div>
											<div class="flex items-center justify-between gap-4">
												<span class="text-muted-foreground">Correct</span>
												<span class="font-mono font-medium tabular-nums">{row.correct}</span>
											</div>
											<div class="flex items-center justify-between gap-4">
												<span class="text-muted-foreground">Wrong</span>
												<span class="font-mono font-medium tabular-nums">{row.wrong}</span>
											</div>
										{/if}
									{/snippet}
								</ChartHoverTooltip>
							{/snippet}
						</BarChart>
					</div>
					<div class="pointer-events-none absolute inset-0">
						<LineChart
							class="h-full w-full"
							data={accuracyBars}
							x="dayKey"
							xScale={accuracyXScale}
							yDomain={[0, 100]}
							axis={false}
							pointerEvents={false}
							series={[{ key: 'accuracy', label: 'Accuracy', color: chartConfig.accuracy.color }]}
							props={{
								spline: {
									curve: curveLinear,
									defined: isDefined,
									...(reducedMotion.current ? {} : { motion: 'tween' as const }),
									strokeWidth: 2
								}
							}}
						/>
					</div>
				</Chart.Container>
			</div>
		{/if}
	</Card.Content>
</Card.Root>
