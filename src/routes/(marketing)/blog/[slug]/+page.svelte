<script lang="ts">
	import PublicPageHero from '$lib/components/marketing/public-page-hero.svelte';
	import BlogRelatedLinks from '$lib/components/blog/blog-related-links.svelte';
	import type { PageData } from './$types';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button/index.js';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';

	let { data }: { data: PageData } = $props();

	function formatDate(iso: string | null): string {
		if (!iso) return '';
		return new Date(iso).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>{data.post.title} – Free AP Practice Blog</title>
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
					meta={formatDate(data.post.publishedAt ?? data.post.createdAt)}
				/>

				<!-- Text is pre sanitized from the server and only the article is in the serif font because it look better I guess -->
				<div
					class="max-w-none font-serif text-base leading-[1.75] text-foreground [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-[3px] [&_a:hover]:opacity-80 [&_blockquote]:my-0 [&_blockquote]:border-l-[3px] [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:font-normal [&_blockquote]:text-muted-foreground [&_blockquote]:italic [&_code]:font-mono [&_code]:text-[0.875em] [&_code:not(pre_code)]:rounded-[0.3em] [&_code:not(pre_code)]:border [&_code:not(pre_code)]:border-border [&_code:not(pre_code)]:bg-muted [&_code:not(pre_code)]:px-[0.4em] [&_code:not(pre_code)]:py-[0.15em] [&_h1]:mt-[2em] [&_h1]:mb-3 [&_h1]:text-[2em] [&_h1]:font-semibold [&_h1]:tracking-[-0.025em] [&_h2]:mt-[2em] [&_h2]:mb-3 [&_h2]:text-[1.5em] [&_h2]:font-semibold [&_h2]:tracking-[-0.025em] [&_h3]:mt-[2em] [&_h3]:mb-3 [&_h3]:text-[1.25em] [&_h3]:font-semibold [&_h3]:tracking-[-0.025em] [&_h4]:mt-[2em] [&_h4]:mb-3 [&_h4]:text-[1.1em] [&_h4]:font-semibold [&_h4]:tracking-[-0.025em] [&_hr]:my-[2em] [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-border [&_img]:my-6 [&_img]:max-w-full [&_img]:rounded-lg [&_li]:mb-[0.4em] [&_ol]:mb-5 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mt-0 [&_p]:mb-5 [&_pre]:mb-6 [&_pre]:overflow-x-auto [&_pre]:rounded-[0.6em] [&_pre]:border [&_pre]:border-border [&_pre]:bg-card [&_pre]:p-4 [&_pre_code]:border-0 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:mb-6 [&_table]:w-full [&_table]:border-collapse [&_table]:text-[0.9em] [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:text-left [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_ul]:mb-5 [&_ul]:list-disc [&_ul]:pl-6"
				>
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
