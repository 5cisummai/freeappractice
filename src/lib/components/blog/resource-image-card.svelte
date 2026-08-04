<script lang="ts">
	import { resolve } from '$app/paths';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { buttonVariants } from '$lib/components/ui/button/button.svelte';
	import { cn } from '$lib/utils';
	import ArrowUpRightIcon from '@lucide/svelte/icons/arrow-up-right';

	let {
		href,
		title,
		description,
		coverImage,
		external = false,
		badge
	}: {
		href: string;
		title: string;
		description: string;
		coverImage: string;
		external?: boolean;
		badge?: string;
	} = $props();
</script>

{#snippet cardContent()}
	<div class="p-4 pb-0">
		<div class="overflow-hidden rounded-xl">
			<img
				src={coverImage}
				alt=""
				class="aspect-16/10 w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
				loading="lazy"
				decoding="async"
			/>
		</div>
	</div>

	<div class="flex flex-1 flex-col p-5 pt-4 sm:p-6">
		{#if badge}
			<div class="flex items-center justify-end gap-3 text-sm text-muted-foreground">
				<Badge variant="outline" class="rounded-full px-2.5 py-0.5 text-xs font-normal">
					{badge}
				</Badge>
			</div>
		{/if}

		<h2
			class={cn(
				'text-lg leading-snug font-semibold tracking-tight text-balance sm:text-xl',
				badge ? 'mt-4' : 'mt-0'
			)}
		>
			{title}
		</h2>

		<p class="mt-3 line-clamp-3 flex-1 text-sm leading-7 text-muted-foreground">
			{description}
		</p>

		<div class="mt-6 flex items-center justify-end gap-4">
			<div
				class={cn(
					buttonVariants({ variant: 'outline' }),
					'transition-colors group-hover:border-black group-hover:bg-black group-hover:text-white dark:group-hover:border-white dark:group-hover:bg-white dark:group-hover:text-black'
				)}
			>
				<ArrowUpRightIcon class="size-4" />
			</div>
		</div>
	</div>
{/snippet}

<article
	class="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-md"
>
	{#if external}
		<a {href} class="flex h-full flex-col" target="_blank" rel="noopener noreferrer">
			{@render cardContent()}
		</a>
	{:else}
		<a
			href={resolve(
				href as '/blog' | '/blog/science-of-studying' | '/blog/summer-ap-study-plan'
			)}
			class="flex h-full flex-col"
		>
			{@render cardContent()}
		</a>
	{/if}
</article>
