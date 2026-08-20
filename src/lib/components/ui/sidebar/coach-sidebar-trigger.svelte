<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { cn } from '$lib/utils.js';
	import type { ComponentProps } from 'svelte';
	import { useCoachSidebar } from './coach-context.svelte.js';

	let {
		class: className,
		onclick,
		...restProps
	}: ComponentProps<typeof Button> & {
		onclick?: (event: MouseEvent) => void;
	} = $props();

	const sidebar = useCoachSidebar();
</script>

{#if !sidebar.open}
	<Button
		data-sidebar="coach-trigger"
		data-slot="coach-sidebar-trigger"
		variant="outline"
		size="sm"
		class={cn('hidden md:inline-flex', className)}
		type="button"
		aria-label="Ask Coach"
		aria-expanded={false}
		title="Ask Coach"
		onclick={(event) => {
			onclick?.(event);
			sidebar.toggle();
		}}
		{...restProps}
	>
		<span>Ask coach</span>
	</Button>
{/if}
