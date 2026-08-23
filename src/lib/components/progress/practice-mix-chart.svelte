<script lang="ts">
	import { PieChart, Text } from 'layerchart';
	import { MediaQuery } from 'svelte/reactivity';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Chart from '$lib/components/ui/chart/index.js';
	import * as Empty from '$lib/components/ui/empty/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { resolve } from '$app/paths';
	import type { PracticeMixSlice } from './progress-insights.js';

	let { slices }: { slices: PracticeMixSlice[] } = $props();

	const reducedMotion = new MediaQuery('(prefers-reduced-motion: reduce)');
	const chartConfig = {
		count: { label: 'Practice items' },
		mcq: { label: 'MCQ', color: 'var(--primary)' },
		frq: { label: 'FRQ', color: 'var(--chart-2)' },
		quiz: { label: 'Quiz', color: 'var(--accent-foreground)' }
	} satisfies Chart.ChartConfig;

	const total = $derived(slices.reduce((sum, slice) => sum + slice.count, 0));
	const chartData = $derived(
		slices.map((slice) => ({
			type: slice.type,
			count: slice.count,
			color: `var(--color-${slice.type})`
		}))
	);
</script>

<Card.Root class="flex flex-col">
	<Card.Header>
		<Card.Title>Practice mix</Card.Title>
		<Card.Description>How your practice is distributed.</Card.Description>
	</Card.Header>
	<Card.Content class="flex-1">
		{#if total === 0}
			<Empty.Root class="min-h-48 border-0 p-6">
				<Empty.Header>
					<Empty.Title>No practice history yet</Empty.Title>
					<Empty.Description>Start practicing to see how your work is split.</Empty.Description>
				</Empty.Header>
				<Empty.Content>
					<Button href={resolve('/app/practice')}>Start practicing</Button>
				</Empty.Content>
			</Empty.Root>
		{:else}
			<Chart.Container config={chartConfig} class="mx-auto aspect-square max-h-64">
				<PieChart
					data={chartData}
					key="type"
					value="count"
					c="color"
					innerRadius={60}
					padding={28}
					legend
					props={{ pie: reducedMotion.current ? {} : { motion: 'tween' as const } }}
				>
					{#snippet aboveMarks()}
						<Text
							value={String(total)}
							textAnchor="middle"
							verticalAnchor="middle"
							class="fill-foreground text-3xl! font-bold"
							dy={3}
						/>
						<Text
							value="items"
							textAnchor="middle"
							verticalAnchor="middle"
							class="fill-muted-foreground!"
							dy={22}
						/>
					{/snippet}
					{#snippet tooltip()}
						<Chart.Tooltip hideLabel nameKey="type" />
					{/snippet}
				</PieChart>
			</Chart.Container>
		{/if}
	</Card.Content>
</Card.Root>
