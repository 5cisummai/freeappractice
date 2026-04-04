
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

	const AP_EXAM_START = new Date(2026, 4, 4);

	function getDaysUntilExamStart(): number {
		const today = new Date();
		const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
		const startOfExam = new Date(
			AP_EXAM_START.getFullYear(),
			AP_EXAM_START.getMonth(),
			AP_EXAM_START.getDate()
		);

		const diffMs = startOfExam.getTime() - startOfToday.getTime();
		return Math.max(0, Math.floor(diffMs / 86_400_000));
	}

	const daysUntilExamStart = getDaysUntilExamStart();

	function goToPractice() {
		window.location.href = resolve('/');
	}

	const popularPosts = [
		{ title: 'The Science of Studying', slug: 'science_of_studying' },
		{ title: 'A Simple FRQ Guide', slug: 'simple_frq_guide' },
		{ title: 'Stop Studying Harder', slug: 'stop_studying_harder' },
		{ title: 'Subject-Specific Tips', slug: 'subject_specific' }
	];
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
		<div class="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 lg:py-16">
		<div class="flex items-start justify-center gap-10">

		<article class="w-full min-w-0 max-w-3xl">
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

			<!-- Text is pre sanitized from the server and only the article is in the serif font because it look better I guess -->
			<div class="blog-serif prose prose-neutral dark:prose-invert max-w-none">
				{@html data.htmlContent}
			</div>

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

		<aside class="hidden w-64 shrink-0 lg:sticky lg:top-8 lg:block lg:self-start xl:w-72">
			<div class="flex flex-col gap-4">

				<div class="rounded-xl border border-border/60 bg-card p-4">
					<p class="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Free AP Practice</p>
					<p class="mb-2 text-xs text-muted-foreground">No Strings Attached!</p>
					<h2 class="mb-3 text-sm font-semibold leading-snug text-foreground">Ready to test yourself?</h2>
					<button
						onclick={goToPractice}
						class="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 active:opacity-80"
					>
						Start Practicing →
					</button>
				</div>

				{#if daysUntilExamStart > 0}
				<div class="rounded-xl border border-border/60 bg-card p-4 text-center">
					<p class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">AP Exams begin in</p>
					<p class="mt-1 text-3xl font-bold tabular-nums text-foreground">{daysUntilExamStart}</p>
					<p class="text-[11px] text-muted-foreground">{daysUntilExamStart === 1 ? 'day' : 'days'}</p>
				</div>
				{/if}

				<div class="rounded-xl border border-border/60 bg-card p-4">
					<p class="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Top Study Guides</p>
					<ul class="flex flex-col gap-1.5">
						{#each popularPosts.filter(p => p.slug !== data.post.slug) as post (post.slug)}
							<li>
								<a
									href={resolve(`/blog/${post.slug}`)}
									class="block rounded-md px-2 py-1.5 text-sm text-foreground/80 transition-colors hover:bg-muted/50 hover:text-foreground"
								>
									{post.title}
								</a>
							</li>
						{/each}
					</ul>
				</div>

				<div class="rounded-xl border border-border/60 bg-card p-4">
					<p class="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">About</p>
					<p class="text-xs leading-relaxed text-muted-foreground">
						FreeAPPractice.org is a free, student-built tool that utilizes AI to create unlimited AP-style practice questions across 20+ subjects to help students prepare.
					</p>
				</div>

			</div>
		</aside>

		</div>
		</div>
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
