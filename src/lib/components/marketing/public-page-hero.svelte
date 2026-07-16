<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		description,
		meta,
		align = 'center',
		class: className = '',
		eyebrow,
		actions
	}: {
		title: string;
		description?: string;
		meta?: string;
		align?: 'center' | 'start';
		class?: string;
		eyebrow?: Snippet;
		actions?: Snippet;
	} = $props();

	const alignClass = $derived(align === 'center' ? 'text-center' : 'text-center sm:text-left');
	const descriptionAlignClass = $derived(align === 'center' ? 'mx-auto' : 'mx-auto sm:mx-0');
	const eyebrowAlignClass = $derived(
		align === 'center' ? 'flex justify-center' : 'flex justify-center sm:justify-start'
	);
	const actionsAlignClass = $derived(
		align === 'center'
			? 'flex flex-wrap justify-center gap-3 pt-1'
			: 'flex flex-wrap justify-center gap-3 pt-1 sm:justify-start'
	);
</script>

<header class="mx-auto max-w-3xl space-y-4 {alignClass} {className}">
	{#if eyebrow}
		<div class={eyebrowAlignClass}>
			{@render eyebrow()}
		</div>
	{/if}

	<h1
		class="font-display text-4xl leading-[1.12] font-medium tracking-tight text-balance sm:text-4xl lg:text-5xl"
	>
		{title}
	</h1>

	{#if description}
		<p
			class="text-md {descriptionAlignClass} max-w-2xl leading-8 text-balance text-muted-foreground sm:text-lg"
		>
			{description}
		</p>
	{/if}

	{#if meta}
		<p class="text-sm text-muted-foreground">{meta}</p>
	{/if}

	{#if actions}
		<div class={actionsAlignClass}>
			{@render actions()}
		</div>
	{/if}
</header>
