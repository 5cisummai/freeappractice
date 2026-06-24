<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import ArrowUpDownIcon from '@lucide/svelte/icons/arrow-up-down';
	import { Button } from '$lib/components/ui/button/index.js';

	let {
		label,
		variant = 'ghost',
		class: className = 'h-8 px-2',
		...restProps
	}: ComponentProps<typeof Button> & { label: string } = $props();
</script>

<Button {variant} class={className} {...restProps}>
	{label}
	<ArrowUpDownIcon class="ms-2 size-4" />
</Button>
