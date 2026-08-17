<script lang="ts">
	import { Tabs as TabsPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: TabsPrimitive.ContentProps = $props();
</script>

<TabsPrimitive.Content
	bind:ref
	data-slot="tabs-content"
	class={cn(
		'flex-1 text-sm outline-none data-[state=active]:animate-in data-[state=active]:duration-200 data-[state=active]:fade-in motion-reduce:animate-none',
		className
	)}
	{...restProps}
/>
