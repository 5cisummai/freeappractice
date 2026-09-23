<script lang="ts">
	import { cn } from '$lib/utils';
	import { type Icon as IconType } from '@lucide/svelte';
	import DotIcon from '@lucide/svelte/icons/dot';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface ChainOfThoughtStepProps extends HTMLAttributes<HTMLDivElement> {
		icon?: typeof IconType;
		label?: string;
		description?: string;
		status?: 'complete' | 'active' | 'pending';
		children?: Snippet;
		class?: string;
	}

	let {
		icon: Icon = DotIcon,
		label,
		description,
		status = 'complete',
		children,
		class: className,
		...restProps
	}: ChainOfThoughtStepProps = $props();

	const statusStyles = {
		complete: 'text-muted-foreground',
		active: 'text-foreground',
		pending: 'text-muted-foreground/50'
	};
</script>

<div
	data-chain-step
	class={cn('group/chain-step relative flex gap-2 text-sm', statusStyles[status], className)}
	{...restProps}
>
	<div class="relative z-10 mt-0.5 size-4 shrink-0">
		<Icon class="size-4" />
	</div>
	<div
		class="absolute top-5 -bottom-3 left-[7px] w-px bg-border group-last/chain-step:hidden"
		aria-hidden="true"
	></div>
	<div class="min-w-0 flex-1 space-y-2">
		{#if label}<div>{label}</div>{/if}
		{#if description}
			<div class="text-xs text-muted-foreground">{description}</div>
		{/if}
		{#if children}
			{@render children()}
		{/if}
	</div>
</div>
