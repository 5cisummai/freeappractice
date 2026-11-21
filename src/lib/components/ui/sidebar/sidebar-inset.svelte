<script lang="ts">
	import { cn, type WithElementRef } from '#lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLElement>> = $props();
</script>

<main
	id="main-content"
	bind:this={ref}
	data-slot="sidebar-inset"
	class={cn(
		'relative flex w-full flex-1 flex-col bg-background md:peer-data-[variant=inset]:rounded-l-xl md:peer-data-[variant=inset]:shadow-sm dark:md:peer-data-[variant=inset]:border dark:md:peer-data-[variant=inset]:border-border/50 dark:md:peer-data-[variant=inset]:shadow-none',
		className
	)}
	{...restProps}
>
	{@render children?.()}
</main>
