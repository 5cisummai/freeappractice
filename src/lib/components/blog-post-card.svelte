<script lang="ts">
	import { resolve } from '$app/paths';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { formatBlogDate, getBlogCategory, resolveBlogCoverUrl } from '$lib/blog-display';
	import ArrowUpRightIcon from '@lucide/svelte/icons/arrow-up-right';
	import CalendarIcon from '@lucide/svelte/icons/calendar';

	let {
		slug,
		title,
		excerpt,
		publishedAt,
		createdAt,
		coverImage = null,
		tags = []
	}: {
		slug: string;
		title: string;
		excerpt: string;
		publishedAt: string | null;
		createdAt: string;
		coverImage?: string | null;
		tags?: string[];
	} = $props();

	const dateIso = $derived(publishedAt ?? createdAt);
	const coverUrl = $derived(resolveBlogCoverUrl(slug, coverImage));
	const category = $derived(getBlogCategory(slug, tags));
</script>

<article
	class="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-md"
>
	<a href={resolve(`/blog/${slug}`)} class="flex h-full flex-col">
		<div class="p-4 pb-0">
			{#if coverUrl}
				<img
					src={coverUrl}
					alt=""
					class="aspect-16/10 w-full rounded-xl object-cover"
					loading="lazy"
					decoding="async"
				/>
			{:else}
				<div
					class="aspect-16/10 w-full rounded-xl bg-linear-to-br from-sky-100 via-violet-100 to-rose-100 dark:from-sky-950/40 dark:via-violet-950/40 dark:to-rose-950/40"
					aria-hidden="true"
				></div>
			{/if}
		</div>

		<div class="flex flex-1 flex-col p-5 pt-4 sm:p-6">
			<div class="flex items-center justify-between gap-3 text-sm text-muted-foreground">
				<time class="inline-flex items-center gap-1.5" datetime={dateIso}>
					<CalendarIcon class="size-3.5 shrink-0" />
					{formatBlogDate(dateIso)}
				</time>
				<Badge variant="outline" class="rounded-full px-2.5 py-0.5 text-xs font-normal">
					{category}
				</Badge>
			</div>

			<h2 class="mt-4 text-lg leading-snug font-semibold tracking-tight text-balance sm:text-xl">
				{title}
			</h2>

			<p class="mt-3 line-clamp-3 flex-1 text-sm leading-7 text-muted-foreground">
				{excerpt}
			</p>

			<div class="mt-6 flex items-center justify-end gap-4">
				<Button variant="outline" href={resolve(`/blog/${slug}`)}>
					<ArrowUpRightIcon class="size-4" />
				</Button>
			</div>
		</div>
	</a>
</article>
