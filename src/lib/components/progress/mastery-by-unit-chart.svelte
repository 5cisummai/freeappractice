<script lang="ts">
	import { scaleBand } from 'd3-scale';
	import { BarChart } from 'layerchart';
	import { MediaQuery } from 'svelte/reactivity';
	import { cubicInOut } from 'svelte/easing';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Chart from '$lib/components/ui/chart/index.js';
	import * as Empty from '$lib/components/ui/empty/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { resolve } from '$app/paths';
	import ChartHoverTooltip from './chart-hover-tooltip.svelte';
	import type { MasteryBarRow } from './progress-insights.js';

	let { rows }: { rows: MasteryBarRow[] } = $props();

	const reducedMotion = new MediaQuery('(prefers-reduced-motion: reduce)');
	const chartConfig = {
		mastery: { label: 'Mastery', color: 'var(--primary)' }
	} satisfies Chart.ChartConfig;

	const chartHeight = $derived(Math.max(240, rows.length * 36));

	function truncateLabel(label: string): string {
		return label.length > 28 ? `${label.slice(0, 27)}…` : label;
	}
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>Mastery by unit</Card.Title>
		<Card.Description>Your accuracy across the units you have practiced.</Card.Description>
	</Card.Header>
	<Card.Content>
		{#if rows.length === 0}
			<Empty.Root class="min-h-48 border-0 p-6">
				<Empty.Header>
					<Empty.Title>No unit mastery yet</Empty.Title>
					<Empty.Description>Practice a unit to see it here.</Empty.Description>
				</Empty.Header>
				<Empty.Content>
					<Button href={resolve('/app/practice')}>Start practicing</Button>
				</Empty.Content>
			</Empty.Root>
		{:else}
			<div style:height={`${chartHeight}px`}>
				<Chart.Container config={chartConfig} class="aspect-auto h-full w-full">
					<BarChart
						data={rows}
						orientation="horizontal"
						yScale={scaleBand().padding(0.25)}
						y="label"
						series={[{ key: 'mastery', label: 'Mastery', color: chartConfig.mastery.color }]}
						padding={{ left: 8, right: 12 }}
						grid={false}
						rule={false}
						axis="y"
						props={{
							bars: {
								stroke: 'none',
								radius: 5,
								insets: { left: 8 },
								rounded: 'all',
								initialWidth: reducedMotion.current ? undefined : 0,
								initialX: reducedMotion.current ? undefined : 0,
								...(reducedMotion.current
									? {}
									: {
											motion: {
												x: { type: 'tween' as const, duration: 500, easing: cubicInOut },
												width: { type: 'tween' as const, duration: 500, easing: cubicInOut }
											}
										})
							},
							highlight: { area: { fill: 'none' } },
							yAxis: { format: (d: string) => truncateLabel(d) }
						}}
					>
						{#snippet tooltip()}
							<ChartHoverTooltip>
								{#snippet children({ data })}
									{@const row = data as MasteryBarRow | undefined}
									{#if row}
										<div class="font-medium">{row.label}</div>
										<div class="flex items-center justify-between gap-4">
											<span class="text-muted-foreground">Mastery</span>
											<span class="font-mono font-medium tabular-nums">{row.mastery}%</span>
										</div>
										<div class="flex items-center justify-between gap-4">
											<span class="text-muted-foreground">Attempts</span>
											<span class="font-mono font-medium tabular-nums">{row.attempts}</span>
										</div>
									{/if}
								{/snippet}
							</ChartHoverTooltip>
						{/snippet}
					</BarChart>
				</Chart.Container>
			</div>
		{/if}
	</Card.Content>
</Card.Root>
