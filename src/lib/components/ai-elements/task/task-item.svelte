<script lang="ts">
	import { cn } from '$lib/utils';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	export interface TaskItemProps extends HTMLAttributes<HTMLDivElement> {
		children?: Snippet;
		class?: string;
	}

	let { children, class: className, ...restProps }: TaskItemProps = $props();
</script>

<div class={cn('text-sm text-muted-foreground', className)} {...restProps}>
	{@render children?.()}
</div>
