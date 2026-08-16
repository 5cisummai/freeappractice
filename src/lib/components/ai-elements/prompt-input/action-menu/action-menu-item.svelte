<script lang="ts">
	import { cn } from '$lib/utils';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import type { ComponentProps, Snippet } from 'svelte';

	type Props = Omit<ComponentProps<typeof DropdownMenu.Item>, 'children'> & {
		children?: Snippet;
		variant?: 'default' | 'destructive';
	};

	let { class: className, children, onSelect, ...props }: Props = $props();
</script>

<DropdownMenu.Item class={cn(className)} {onSelect} {...props}>
	{#if children}
		{@render children()}
	{/if}
</DropdownMenu.Item>
