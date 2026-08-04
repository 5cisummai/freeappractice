<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		description,
		maskTitle = false,
		actions,
		children
	}: {
		title: string;
		description: string;
		/** When true, the title is hashed in PostHog session recordings. */
		maskTitle?: boolean;
		actions?: Snippet;
		children: Snippet;
	} = $props();
</script>

<div class="mx-auto w-full max-w-6xl space-y-8 px-5 py-10 sm:px-8 sm:py-12 lg:px-10">
	<header class="flex items-start justify-between gap-4">
		<div class="min-w-0 space-y-2">
			<h1
				class="font-display text-3xl leading-[1.12] font-medium tracking-tight text-balance sm:text-4xl"
				class:ph-mask-pii={maskTitle}
			>
				{title}
			</h1>
			<p class="text-base leading-7 text-muted-foreground">{description}</p>
		</div>
		{#if actions}
			<div class="shrink-0 pt-1.5">
				{@render actions()}
			</div>
		{/if}
	</header>

	<div class="space-y-8">
		{@render children()}
	</div>
</div>
