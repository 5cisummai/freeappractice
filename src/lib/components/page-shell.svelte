<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		description,
		children
	}: {
		title: string;
		description: string;
		children: Snippet;
	} = $props();
</script>

<div class="mx-auto w-full max-w-6xl space-y-8 px-5 py-10 sm:px-8 sm:py-12 lg:px-10">
	<header class="space-y-2">
		<h1
			class="font-display text-3xl leading-[1.12] font-medium tracking-tight text-balance sm:text-4xl"
		>
			{title}
		</h1>
		<p class="text-base leading-7 text-muted-foreground">{description}</p>
	</header>

	<div class="space-y-8">
		{@render children()}
	</div>
</div>
