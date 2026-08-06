<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		description,
		imageUrl,
		imageAlt = '',
		children
	}: {
		title: string;
		description: string;
		imageUrl: string;
		imageAlt?: string;
		children?: Snippet;
	} = $props();
</script>

<div class="rounded-2xl border border-dashed border-border/70 p-10 text-center">
	<img
		src={imageUrl}
		alt={imageAlt}
		loading="lazy"
		decoding="async"
		class="mx-auto mb-4 h-64 w-auto max-w-xs dark:invert"
	/>
	<h2 class="font-medium text-muted-foreground">{title}</h2>
	<p class="mt-1 text-sm text-muted-foreground">{description}</p>
	{#if children}
		<div class="mt-4">
			{@render children()}
		</div>
	{/if}
</div>
