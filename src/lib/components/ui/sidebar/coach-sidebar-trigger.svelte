<script lang="ts">
	import PanelLeftIcon from '@tabler/icons-svelte/icons/layout-sidebar';
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

<Button
	data-sidebar="coach-trigger"
	data-slot="coach-sidebar-trigger"
	variant="ghost"
	size="icon-sm"
	class={cn('hidden md:inline-flex', className)}
	type="button"
	aria-label="Toggle Coach sidebar"
	aria-expanded={sidebar.open}
	title="Coach"
	onclick={(event) => {
		onclick?.(event);
		sidebar.toggle();
	}}
	{...restProps}
>
	<PanelLeftIcon class="rotate-180" />
	<span class="sr-only">Toggle Coach sidebar</span>
</Button>
