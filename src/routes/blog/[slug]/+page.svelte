
<script lang="ts">
	import Topbar from '$lib/components/topbar.svelte';
	import SiteFooter from '$lib/components/site-footer.svelte';
	import type { PageData } from './$types';
    import { resolve } from '$app/paths';

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
	<Topbar />

	<main class="flex-1">
		<article class="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
			<!-- Back link -->
			<a
				href={resolve('/blog')}
				class="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
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
				All posts
			</a>

			{#if data.post.coverImage}
				<img
					src={data.post.coverImage}
					alt={data.post.title}
					class="mb-8 h-64 w-full rounded-xl object-cover sm:h-80"
				/>
			{/if}

			<!-- Tags -->
			{#if data.post.tags.length > 0}
				<div class="mb-4 flex flex-wrap gap-2">
					{#each data.post.tags as tag (tag)}
						<span
							class="rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 text-xs text-muted-foreground"
						>
							{tag}
						</span>
					{/each}
				</div>
			{/if}

			<h1 class="mb-3 text-3xl font-semibold tracking-tight sm:text-4xl">
				{data.post.title}
			</h1>

			<p class="mb-4 text-base leading-relaxed text-muted-foreground">
				{data.post.excerpt}
			</p>

			<p class="mb-8 text-sm text-muted-foreground">
				{formatDate(data.post.publishedAt ?? data.post.createdAt)}
			</p>

			<!-- Markdown content -->
			<div class="prose prose-neutral dark:prose-invert max-w-none">
				{@html data.htmlContent}
			</div>

			<!-- Back link bottom -->
			<div class="mt-12 border-t border-border/70 pt-8">
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
	</main>

	<SiteFooter />
</div>

<style>
	.blog-serif {
		font-family:
			'Iowan Old Style',
			'Palatino Linotype',
			Palatino,
			'Book Antiqua',
			Georgia,
			'Times New Roman',
			serif;
	}

	/* Prose styles since @tailwindcss/typography may not be installed */
	:global(.prose) {
		color: oklch(var(--foreground));
		line-height: 1.75;
		font-size: 1rem;
		font-family:
			'Iowan Old Style',
			'Palatino Linotype',
			Palatino,
			'Book Antiqua',
			Georgia,
			'Times New Roman',
			serif;
	}
	:global(.prose h1),
	:global(.prose h2),
	:global(.prose h3),
	:global(.prose h4) {
		font-weight: 600;
		letter-spacing: -0.025em;
		margin-top: 2em;
		margin-bottom: 0.75em;
		color: inherit;
	}
	:global(.prose h1) { font-size: 2em; }
	:global(.prose h2) { font-size: 1.5em; }
	:global(.prose h3) { font-size: 1.25em; }
	:global(.prose h4) { font-size: 1.1em; }
	:global(.prose p) {
		margin-top: 0;
		margin-bottom: 1.25em;
	}
	:global(.prose a) {
		color: oklch(var(--primary));
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	:global(.prose a:hover) { opacity: 0.8; }
	:global(.prose ul),
	:global(.prose ol) {
		padding-left: 1.5em;
		margin-bottom: 1.25em;
	}
	:global(.prose ul) { list-style-type: disc; }
	:global(.prose ol) { list-style-type: decimal; }
	:global(.prose li) { margin-bottom: 0.4em; }
	:global(.prose blockquote) {
		border-left: 3px solid oklch(var(--border));
		padding-left: 1em;
		margin-left: 0;
		color: oklch(var(--muted-foreground));
		font-style: italic;
	}
	:global(.prose code:not(pre code)) {
		background: oklch(var(--muted));
		border: 1px solid oklch(var(--border));
		border-radius: 0.3em;
		padding: 0.15em 0.4em;
		font-size: 0.875em;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
	}
	:global(.prose pre) {
		background: oklch(var(--card));
		border: 1px solid oklch(var(--border));
		border-radius: 0.6em;
		padding: 1em 1.25em;
		overflow-x: auto;
		margin-bottom: 1.5em;
	}
	:global(.prose pre code) {
		background: none;
		border: none;
		padding: 0;
		font-size: 0.875em;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
	}
	:global(.prose hr) {
		border: none;
		border-top: 1px solid oklch(var(--border));
		margin: 2em 0;
	}
	:global(.prose img) {
		max-width: 100%;
		border-radius: 0.5em;
		margin: 1.5em 0;
	}
	:global(.prose table) {
		width: 100%;
		border-collapse: collapse;
		margin-bottom: 1.5em;
		font-size: 0.9em;
	}
	:global(.prose th),
	:global(.prose td) {
		border: 1px solid oklch(var(--border));
		padding: 0.5em 0.75em;
		text-align: left;
	}
	:global(.prose th) {
		background: oklch(var(--muted));
		font-weight: 600;
	}
</style>
