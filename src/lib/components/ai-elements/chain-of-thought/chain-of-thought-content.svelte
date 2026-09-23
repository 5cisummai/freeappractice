<script lang="ts">
	import { cn } from '$lib/utils';
	import { CollapsibleContent } from '$lib/components/ui/collapsible/index.js';
	import type { Snippet } from 'svelte';

	interface ChainOfThoughtContentProps {
		children: Snippet;
		class?: string;
	}

	let { children, class: className }: ChainOfThoughtContentProps = $props();
</script>

<CollapsibleContent
	class={cn(
		'mt-2 space-y-3',
		'text-popover-foreground outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:animate-in data-[state=open]:slide-in-from-top-2',
		className
	)}
>
	{@render children()}
</CollapsibleContent>
