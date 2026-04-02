<script lang="ts">
	import Topbar from '$lib/components/topbar.svelte';
	import SiteFooter from '$lib/components/site-footer.svelte';
	import type { PageData } from './$types';

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
	<title>Blog – Free AP Practice</title>
	<meta name="description" content="Tips, updates, and study guides from the Free AP Practice team." />
	<link rel="canonical" href="https://freeappractice.org/blog" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://freeappractice.org/blog" />
	<meta property="og:title" content="Blog – Free AP Practice" />
	<meta property="og:description" content="Tips, updates, and study guides from the Free AP Practice team." />
	<meta property="og:image" content="https://freeappractice.org/icon.png" />
	<meta property="og:site_name" content="FreeAPPractice.org" />
	<meta property="og:locale" content="en_US" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:url" content="https://freeappractice.org/blog" />
	<meta name="twitter:title" content="Blog – Free AP Practice" />
	<meta name="twitter:description" content="Tips, updates, and study guides from the Free AP Practice team." />
	<meta name="twitter:image" content="https://freeappractice.org/icon.png" />
</svelte:head>

<div class="flex min-h-screen flex-col bg-background text-foreground">
	<Topbar />

	<main class="flex-1">
		<div class="blog-serif mx-auto w-full max-w-4xl px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
			<div class="mb-10 space-y-2">
				<h1 class="text-4xl font-semibold tracking-tight">Blog</h1>
				<p class="text-muted-foreground">Tips, updates, and study guides from the team.</p>
			</div>

			{#if data.posts.length === 0}
				<div class="rounded-xl border border-border/70 bg-card px-8 py-16 text-center">
					<p class="text-muted-foreground">No posts yet - check back soon!</p>
				</div>
			{:else}
				<ul class="space-y-6">
					{#each data.posts as post (post._id)}
						<li>
							<a
								href="/blog/{post.slug}"
								class="group block rounded-xl border border-border/70 bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
							>
								{#if post.coverImage}
									<img
										src={post.coverImage}
										alt={post.title}
										class="mb-5 h-48 w-full rounded-lg object-cover"
									/>
								{/if}

								<div class="space-y-2">
									<div class="flex flex-wrap gap-2">
										{#each post.tags as tag (tag)}
											<span
												class="rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 text-xs text-muted-foreground"
											>
												{tag}
											</span>
										{/each}
									</div>

									<h2
										class="text-xl font-semibold tracking-tight transition-colors group-hover:text-primary"
									>
										{post.title}
									</h2>

									<p class="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
										{post.excerpt}
									</p>

									<p class="text-xs text-muted-foreground/70">
										{formatDate(post.publishedAt ?? post.createdAt)}
									</p>
								</div>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
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

	.blog-serif h1,
	.blog-serif h2,
	.blog-serif h3 {
		line-height: 1.2;
	}
</style>
