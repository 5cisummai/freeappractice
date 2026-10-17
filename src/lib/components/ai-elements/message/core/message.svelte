<script lang="ts">
	import { cn } from '#lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLDivElement> {
		from: string;
		class?: string;
		children: Snippet;
	}

	let { from, class: className, children, ...restProps }: Props = $props();
</script>

<div
	class={cn(
		'group flex w-full max-w-[95%] min-w-0 flex-col gap-2',
		from === 'user' ? 'is-user ml-auto justify-end' : 'is-assistant',
		className
	)}
	data-role={from}
	{...restProps}
>
	{@render children()}
</div>
