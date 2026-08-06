<script lang="ts">
	import { Collapsible } from '$lib/components/ui/collapsible/index.js';
	import { cn } from '$lib/utils';
	import type { Snippet } from 'svelte';

	// indexing

	interface ToolProps {
		class?: string;
		children?: Snippet;
		[key: string]: unknown;
	}

	let { class: className = '', children, ...restProps }: ToolProps = $props();

	let id = $derived.by(() => crypto.randomUUID());
</script>

<Collapsible {id} class={cn('not-prose mb-0 w-fit max-w-full', className)} {...restProps}>
	{@render children?.()}
</Collapsible>
