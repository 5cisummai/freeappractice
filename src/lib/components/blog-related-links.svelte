<script lang="ts">
	import { resolve } from '$app/paths';
	import type { BlogProductCta, BlogRelatedLink } from '$lib/blog/related-links.js';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';

	let {
		relatedPosts,
		productCta
	}: {
		relatedPosts: BlogRelatedLink[];
		productCta: BlogProductCta;
	} = $props();
</script>

<aside class="mt-12 space-y-8 border-t border-border/70 pt-8" aria-label="Related links">
	{#if relatedPosts.length > 0}
		<section>
			<h2 class="mb-4 text-lg font-semibold tracking-tight">Related reading</h2>
			<ul class="grid gap-3 sm:grid-cols-2">
				{#each relatedPosts as post (post.href)}
					<li>
						<a
							href={resolve(post.href)}
							class="group flex h-full flex-col rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/40"
						>
							<span class="font-medium group-hover:text-primary">{post.label}</span>
							{#if post.description}
								<span class="mt-1 text-sm text-muted-foreground">{post.description}</span>
							{/if}
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<section class="rounded-xl border border-border bg-muted/30 px-5 py-4">
		<h2 class="text-sm font-semibold tracking-wide text-foreground uppercase">Keep practicing</h2>
		<p class="mt-2 text-sm text-muted-foreground">{productCta.description}</p>
		<a
			href={resolve(productCta.href)}
			class="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
		>
			{productCta.label}
			<ArrowRightIcon class="size-4" />
		</a>
	</section>
</aside>
