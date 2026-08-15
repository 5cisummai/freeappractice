<script lang="ts">
	import type { Snippet } from 'svelte';
	import { twAnimateInView } from '$lib/tw-animate';

	type HeadingLevel = 'h1' | 'h2';

	let {
		id,
		headingLevel = 'h2',
		titleClass = 'font-display text-3xl leading-tight font-medium tracking-tight text-balance sm:text-4xl',
		descriptionClass = 'text-base leading-7 text-muted-foreground sm:text-lg',
		class: className = '',
		eyebrow,
		title,
		description,
		actions
	}: {
		id: string;
		headingLevel?: HeadingLevel;
		titleClass?: string;
		descriptionClass?: string;
		class?: string;
		eyebrow?: Snippet;
		title: Snippet;
		description?: Snippet;
		actions?: Snippet;
	} = $props();
</script>

<div class="space-y-3 {twAnimateInView} {className}">
	{#if eyebrow}
		<div>{@render eyebrow()}</div>
	{/if}

	<svelte:element this={headingLevel} {id} class="{titleClass} text-left">
		{@render title()}
	</svelte:element>

	{#if description}
		<div class="{descriptionClass} max-w-2xl text-left">
			{@render description()}
		</div>
	{/if}

	{#if actions}
		{@render actions()}
	{/if}
</div>
