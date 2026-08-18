<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn, type WithElementRef, type WithoutChildren } from '$lib/utils.js';
	import MoreHorizontalIcon from '@tabler/icons-svelte/icons/dots';

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: WithoutChildren<WithElementRef<HTMLAttributes<HTMLSpanElement>>> = $props();
</script>

<span
	bind:this={ref}
	data-slot="breadcrumb-ellipsis"
	role="presentation"
	aria-hidden="true"
	class={cn(
		'flex size-5 items-center justify-center [&>svg]:size-4 [&>svg]:text-muted-foreground',
		className
	)}
	{...restProps}
>
	<MoreHorizontalIcon />
	<span class="sr-only">More</span>
</span>
