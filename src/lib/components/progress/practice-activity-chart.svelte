<script lang="ts">
	import { scaleUtc } from 'd3-scale';
	import { curveLinear } from 'd3-shape';
	import { AreaChart } from 'layerchart';
	import { MediaQuery } from 'svelte/reactivity';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Chart from '$lib/components/ui/chart/index.js';
	import * as Empty from '$lib/components/ui/empty/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { resolve } from '$app/paths';
	import type { ActivityDay } from './progress-insights.js';

	let { days }: { days: ActivityDay[] } = $props();

	const reducedMotion = new MediaQuery('(prefers-reduced-motion: reduce)');
	const chartConfig = {
		mcq: { label: 'MCQ', color: 'var(--primary)' },
		frq: { label: 'FRQ', color: 'var(--chart-2)' },
		quiz: { label: 'Quiz', color: 'var(--accent-foreground)' }
	} satisfies Chart.ChartConfig;

	const hasActivity = $derived(days.some((day) => day.mcq + day.frq + day.quiz > 0));

	function formatTick(value: Date): string {
		return value.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}

	function formatLabel(value: Date): string {
		return value.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
	}
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>Practice activity</Card.Title>
		<Card.Description>The amount and type of practice you complete each day.</Card.Description>
	</Card.Header>
	<Card.Content>
		{#if !hasActivity}
			<Empty.Root class="min-h-48 border-0 p-6">
				<Empty.Header>
					<Empty.Title>No practice in the last 30 days</Empty.Title>
					<Empty.Description>Complete a question to start this chart.</Empty.Description>
				</Empty.Header>
				<Empty.Content>
					<Button href={resolve('/app/practice')}>Start practicing</Button>
				</Empty.Content>
			</Empty.Root>
		{:else}
			<Chart.Container config={chartConfig} class="aspect-auto h-64 w-full">
				<AreaChart
					data={days}
					x="date"
					xScale={scaleUtc()}
					yPadding={[0, 8]}
					axis="x"
					legend
					series={[
						{ key: 'mcq', label: chartConfig.mcq.label, color: 'var(--color-mcq)' },
						{ key: 'frq', label: chartConfig.frq.label, color: 'var(--color-frq)' },
						{ key: 'quiz', label: chartConfig.quiz.label, color: 'var(--color-quiz)' }
					]}
					seriesLayout="stack"
					props={{
						area: {
							curve: curveLinear,
							'fill-opacity': 0.4,
							line: { class: 'stroke-1' },
							...(reducedMotion.current ? {} : { motion: 'tween' as const })
						},
						xAxis: { format: formatTick }
					}}
				>
					{#snippet tooltip()}
						<Chart.Tooltip indicator="dot" labelFormatter={formatLabel} />
					{/snippet}
				</AreaChart>
			</Chart.Container>
		{/if}
	</Card.Content>
</Card.Root>
