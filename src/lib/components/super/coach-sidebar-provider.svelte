<script lang="ts">
	import { onMount } from 'svelte';
	import { cn } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';
	import { setCoachSidebar } from './coach-context.svelte.js';

	const COACH_SIDEBAR_STORAGE_KEY = 'coach-sidebar-open';

	let {
		open = $bindable(false),
		onOpenChange = () => {},
		class: className,
		children,
		...restProps
	}: HTMLAttributes<HTMLDivElement> & {
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
	} = $props();

	setCoachSidebar({
		open: () => open,
		setOpen: (value) => {
			open = value;
			onOpenChange(value);
			localStorage.setItem(COACH_SIDEBAR_STORAGE_KEY, String(value));
		}
	});

	onMount(() => {
		const stored = localStorage.getItem(COACH_SIDEBAR_STORAGE_KEY);
		if (stored === 'true' || stored === 'false') open = stored === 'true';
	});
</script>

<div class={cn('contents', className)} {...restProps}>
	{@render children?.()}
</div>
