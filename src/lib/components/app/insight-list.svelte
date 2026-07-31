<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import { cn } from '$lib/utils.js';
	import { appSurfaceClass } from '$lib/components/app/surface.js';

	export type InsightItem = {
		label: string;
		value: string;
	};

	let {
		title,
		items,
		tone = 'strength',
		class: className = '',
		emptyText = 'Not enough data yet'
	}: {
		title: string;
		items: InsightItem[];
		tone?: 'strength' | 'needs';
		class?: string;
		emptyText?: string;
	} = $props();

	const valueClass = $derived(
		tone === 'strength'
			? 'text-emerald-600 dark:text-emerald-400'
			: 'text-rose-600 dark:text-rose-400'
	);
</script>

<Card.Root class={cn(appSurfaceClass, className)}>
	<Card.Header class="pb-3">
		<Card.Title class="text-base font-semibold tracking-tight">{title}</Card.Title>
	</Card.Header>
	<Card.Content class="space-y-3 pt-0">
		{#if items.length === 0}
			<p class="text-sm text-muted-foreground">{emptyText}</p>
		{:else}
			{#each items as item (item.label)}
				<div class="flex items-center justify-between gap-3">
					<p class="truncate text-sm font-medium">{item.label}</p>
					<span class={cn('shrink-0 text-sm font-semibold tabular-nums', valueClass)}>
						{item.value}
					</span>
				</div>
			{/each}
		{/if}
	</Card.Content>
</Card.Root>
