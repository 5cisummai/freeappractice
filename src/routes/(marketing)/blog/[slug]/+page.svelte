<script lang="ts">
	import PublicPageHero from '$lib/components/marketing/public-page-hero.svelte';
	import BlogRelatedLinks from '$lib/components/blog/blog-related-links.svelte';
	import type { PageData } from './$types';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button/index.js';
	import { formatBlogDate } from '$lib/blog-display';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.post.title} | Free AP Practice Blog</title>
	<meta name="description" content={data.post.excerpt} />
	<link rel="canonical" href={`https://freeappractice.org/blog/${data.post.slug}`} />
	<meta property="og:url" content={`https://freeappractice.org/blog/${data.post.slug}`} />
	{#if data.post.coverImage}
		<meta property="og:image" content={data.post.coverImage} />
	{:else}
		<meta property="og:image" content="https://freeappractice.org/icon.png" />
	{/if}
	<meta property="og:title" content={data.post.title} />
	<meta property="og:description" content={data.post.excerpt} />
	<meta property="og:type" content="article" />
	<meta property="og:site_name" content="FreeAPPractice.org" />
	<meta property="og:locale" content="en_US" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:url" content={`https://freeappractice.org/blog/${data.post.slug}`} />
	<meta name="twitter:title" content={data.post.title} />
	<meta name="twitter:description" content={data.post.excerpt} />
	<meta
		name="twitter:image"
		content={data.post.coverImage ? data.post.coverImage : 'https://freeappractice.org/icon.png'}
	/>
</svelte:head>

<div class="flex min-h-screen flex-col bg-background text-foreground">
	<main id="main-content" class="flex-1">
		<div class="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 lg:py-16">
			<article class="w-full min-w-0">
				<Button variant="ghost" href={resolve('/blog')} class="mb-8">
					<ArrowLeftIcon class="size-4" />
					All posts
				</Button>
				{#if data.post.coverImage}
					<img
						src={data.post.coverImage}
						alt={data.post.title}
						class="mb-8 h-64 w-full rounded-xl object-cover sm:h-80"
					/>
				{/if}

				<PublicPageHero
					align="start"
					class="mb-8"
					title={data.post.title}
					description={data.post.excerpt}
					meta={formatBlogDate(data.post.publishedAt ?? data.post.createdAt)}
				/>

				<!-- Text is pre sanitized from the server and only the article is in the serif font because it look better I guess -->
				<div class="prose">
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					{@html data.htmlContent}
				</div>

				<BlogRelatedLinks relatedPosts={data.relatedPosts} productCta={data.productCta} />

				<div class="mt-8 border-t border-border/70 pt-8">
					<a
						href={resolve('/blog')}
						class="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-4 w-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<path d="m15 18-6-6 6-6" />
						</svg>
						Back to Blog
					</a>
				</div>
			</article>
		</div>
	</main>
</div>
