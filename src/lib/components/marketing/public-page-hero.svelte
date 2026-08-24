<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { HERO_BADGE_CLASS } from '$lib/components/marketing/hero-badge.js';

	let {
		title,
		description,
		meta,
		badge,
		align = 'center',
		class: className = ''
	}: {
		title: string;
		description?: string;
		meta?: string;
		badge?: string;
		align?: 'center' | 'start';
		class?: string;
	} = $props();

	const alignClass = $derived(align === 'center' ? 'text-center' : 'text-center sm:text-left');
	const descriptionAlignClass = $derived(align === 'center' ? 'mx-auto' : 'mx-auto sm:mx-0');
	const badgeAlignClass = $derived(align === 'center' ? '' : 'sm:justify-start');
</script>

<header class="mx-auto max-w-3xl space-y-4 {alignClass} {className}">
	{#if badge}
		<div class="flex justify-center {badgeAlignClass}">
			<Badge variant="outline" class={HERO_BADGE_CLASS}>
				{badge}
			</Badge>
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
</header>
