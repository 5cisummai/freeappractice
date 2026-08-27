<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import PipIcon from '$lib/components/coach/pip-icon.svelte';
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
		aria-label="Ask Pip"
		aria-expanded={false}
		title="Ask Pip"
		onclick={(event) => {
			onclick?.(event);
			sidebar.toggle();
		}}
		{...restProps}
	>
		<span class="inline-flex items-center gap-1.5">
			<PipIcon />
			Ask Pip
		</span>
	</Button>
{/if}
