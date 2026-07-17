<script lang="ts">
	import BlogPostCard from '$lib/components/blog/blog-post-card.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Blog – Free AP Practice</title>
	<meta
		name="description"
		content="AP course planning, summer study guides, and exam prep tips from the Free AP Practice team."
	/>
	<link rel="canonical" href="https://freeappractice.org/blog" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://freeappractice.org/blog" />
	<meta property="og:title" content="Blog – Free AP Practice" />
	<meta
		property="og:description"
		content="Tips, updates, and study guides from the Free AP Practice team."
	/>
	<meta property="og:image" content="https://freeappractice.org/icon.png" />
	<meta property="og:site_name" content="FreeAPPractice.org" />
	<meta property="og:locale" content="en_US" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:url" content="https://freeappractice.org/blog" />
	<meta name="twitter:title" content="Blog – Free AP Practice" />
	<meta
		name="twitter:description"
		content="Tips, updates, and study guides from the Free AP Practice team."
	/>
	<meta name="twitter:image" content="https://freeappractice.org/icon.png" />
</svelte:head>


<main id="main-content" class="flex-1">
	<div class="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
		<header class="max-w-2xl space-y-4">
			<h1
				class="font-display text-4xl leading-[1.12] font-medium tracking-tight text-balance sm:text-5xl"
			>
				Our Blog
			</h1>

			<p class="text-base leading-8 text-muted-foreground sm:text-lg">
				Expand your knowledge with hand-picked guides on course planning, summer study, and
				evidence-backed exam prep.
			</p>
		</header>

		{#if data.posts.length === 0}
			<div class="mt-12 rounded-2xl border border-border bg-card px-8 py-16 text-center">
				<p class="text-muted-foreground">No posts yet — check back soon!</p>
			</div>
		{:else}
			<ul
				class="mt-12 grid list-none grid-cols-1 gap-6 p-0 md:grid-cols-2 lg:grid-cols-3 lg:gap-8"
			>
				{#each data.posts as post (post._id)}
					<li class="min-h-0">
						<BlogPostCard
							slug={post.slug}
							title={post.title}
							excerpt={post.excerpt}
							publishedAt={post.publishedAt}
							createdAt={post.createdAt}
							coverImage={post.coverImage}
							tags={post.tags}
						/>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</main>

