<script lang="ts">
	import { getChartContext, Tooltip as TooltipPrimitive } from 'layerchart';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet<[{ data: unknown }]> } = $props();

	const ctx = getChartContext();
	const data = $derived(ctx.tooltip.data);
</script>

<TooltipPrimitive.Root variant="none">
	<div
		class="grid min-w-40 items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl"
	>
		{@render children({ data })}
	</div>
</TooltipPrimitive.Root>
