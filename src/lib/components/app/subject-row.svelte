<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils.js';

	let {
		title,
		meta,
		value,
		barClass = 'bg-primary',
		barWidth = 0,
		class: className = '',
		action
	}: {
		title: string;
		meta?: string;
		value?: string;
		barClass?: string;
		/** 0–100 */
		barWidth?: number;
		class?: string;
		action?: Snippet;
	} = $props();

	const width = $derived(Math.max(0, Math.min(100, barWidth)));
</script>

<div class={cn('flex items-center gap-4 px-5 py-3.5', className)}>
	<div class="min-w-0 flex-1">
		<p class="truncate text-sm font-medium">{title}</p>
		{#if meta}
			<p class="text-xs text-muted-foreground">{meta}</p>
		{/if}
	</div>
	{#if value !== undefined}
		<div class="flex items-center gap-3 text-right">
			<div class="w-24">
				<div class="h-2 w-full overflow-hidden rounded-full bg-muted">
					<div class={cn('h-full rounded-full transition-all', barClass)} style="width: {width}%"></div>
				</div>
			</div>
			<span class="w-12 text-sm font-medium tabular-nums">{value}</span>
		</div>
	{/if}
	{#if action}
		{@render action()}
	{/if}
</div>
