<script lang="ts">
	import * as Popover from '#lib/components/ui/popover/index.js';
	import { cn } from '#lib/utils.js';
	import type { ComponentProps } from 'svelte';

	type PopoverContentProps = ComponentProps<typeof Popover.Content>;

	let {
		title,
		description,
		class: className,
		...contentProps
	}: {
		title: string;
		description: string;
		class?: string;
	} & PopoverContentProps = $props();
</script>

<Popover.Content
	class={cn(
		'w-[min(20rem,calc(100vw-2rem))] max-w-sm gap-0 overflow-hidden rounded-3xl p-0 shadow-lg',
		className
	)}
	{...contentProps}
>
	<Popover.Header class="flex flex-col items-start gap-1.5 p-4">
		<Popover.Title class="font-display text-base font-semibold tracking-tight text-balance">
			{title}
		</Popover.Title>
		<Popover.Description class="text-start text-sm leading-6 text-pretty">
			{description}
		</Popover.Description>
	</Popover.Header>
</Popover.Content>
