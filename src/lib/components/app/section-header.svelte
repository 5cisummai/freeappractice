<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils.js';

	let {
		title,
		class: className = '',
		action
	}: {
		title: string;
		class?: string;
		action?: Snippet;
	} = $props();
</script>

<div class={cn('mb-4 flex flex-wrap items-end justify-between gap-3', className)}>
	<h2 class="font-display text-xl font-medium tracking-tight sm:text-2xl">{title}</h2>
	{#if action}
		{@render action()}
	{/if}
</div>
