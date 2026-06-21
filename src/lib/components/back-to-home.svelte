<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button/index.js';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';

	let {
		href = resolve('/'),
		label = 'Back to Home',
		class: className = ''
	}: {
		href?: string;
		label?: string;
		class?: string;
	} = $props();
</script>

<Button variant="ghost" {href} class={className}>
	<ArrowLeftIcon class="size-4" />
	{label}
</Button>
