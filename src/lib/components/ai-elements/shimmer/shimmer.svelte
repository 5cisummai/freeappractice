<script lang="ts">
	import { cn } from '$lib/utils';
	import type { ShimmerProps } from './types';

	// indexing

	let {
		children,
		as = 'p',
		class: className,
		duration = 2,
		spread = 2,
		content_length = 30,
		...rest
	}: ShimmerProps = $props();

	// Calculate dynamic spread based on text length
	let dynamicSpread = $derived(content_length * spread);
</script>

<svelte:element
	this={as}
	class={cn(
		'relative inline-block bg-[length:250%_100%,auto] bg-clip-text text-transparent',
		'[background-repeat:no-repeat,padding-box] [--bg:linear-gradient(90deg,#0000_calc(50%-var(--spread)),var(--color-background),#0000_calc(50%+var(--spread)))]',
		'[background-image:var(--bg),linear-gradient(var(--color-muted-foreground),var(--color-muted-foreground))] [background-position:100%_center]',
		'animate-shimmer',
		className
	)}
	style="--spread: {dynamicSpread}px; --shimmer-duration: {duration}s;"
	{...rest}
>
	{@render children()}
</svelte:element>
