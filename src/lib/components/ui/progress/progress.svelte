<script lang="ts">
	import { Progress as ProgressPrimitive } from 'bits-ui';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		max = 100,
		value,
		indicatorClass = 'bg-primary',
		...restProps
	}: WithoutChildrenOrChild<ProgressPrimitive.RootProps> & {
		indicatorClass?: string;
	} = $props();
</script>

<ProgressPrimitive.Root
	bind:ref
	data-slot="progress"
	class={cn(
		'relative flex h-1.5 w-full items-center overflow-x-hidden rounded-full bg-muted',
		className
	)}
	{value}
	{max}
	{...restProps}
>
	<div
		data-slot="progress-indicator"
		class={cn('size-full flex-1 transition-all', indicatorClass)}
		style="transform: translateX(-{100 - (100 * (value ?? 0)) / (max ?? 1)}%)"
	></div>
</ProgressPrimitive.Root>
