<script lang="ts">
	import Topbar from '$lib/components/topbar.svelte';
	import SiteFooter from '$lib/components/site-footer.svelte';
	import PublicPageHero from '$lib/components/public-page-hero.svelte';
	import { resolve } from '$app/paths';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const startHereSlugs = new Set(['which-aps-to-take', 'summer-ap-study-plan']);

	type BentoLayout = {
		class: string;
		gridClass: string;
		showExcerpt: boolean;
	};

	const bentoLayouts: BentoLayout[] = [
		{
			class: 'bg-neutral-200/80 text-neutral-900 dark:bg-neutral-800/60 dark:text-neutral-100',
			gridClass: 'md:col-span-2 md:row-span-2',
			showExcerpt: true
		},
		{
			class: 'bg-emerald-100 text-emerald-950 dark:bg-emerald-950/50 dark:text-emerald-50',
			gridClass: 'md:col-span-1 md:row-span-2',
			showExcerpt: true
		},
		{
			class: 'bg-orange-100 text-orange-950 dark:bg-orange-950/50 dark:text-orange-50',
			gridClass: 'md:col-span-1 md:row-span-2',
			showExcerpt: true
		},
		{
			class: 'bg-rose-100 text-rose-950 dark:bg-rose-950/50 dark:text-rose-50',
			gridClass: 'md:col-span-1 md:row-span-1',
			showExcerpt: false
		},
		{
			class: 'bg-sky-100 text-sky-950 dark:bg-sky-950/50 dark:text-sky-50',
			gridClass: 'md:col-span-1 md:row-span-1',
			showExcerpt: false
		},
		{
			class: 'bg-neutral-200/80 text-neutral-900 dark:bg-neutral-800/60 dark:text-neutral-100',
			gridClass: 'md:col-span-2 md:row-span-1',
			showExcerpt: true
		}
	];

	const defaultLayout: BentoLayout = {
		class: 'bg-violet-100 text-violet-950 dark:bg-violet-950/50 dark:text-violet-50',
		gridClass: 'md:col-span-2',
		showExcerpt: true
	};

	const orderedPosts = $derived.by(() => {
		const startHere = data.posts.filter((post) => startHereSlugs.has(post.slug));
		const startHereIds = new Set(startHere.map((post) => post._id));
		const others = data.posts.filter((post) => !startHereIds.has(post._id));
		return [...startHere, ...others];
	});

	function getLayout(index: number): BentoLayout {
		return bentoLayouts[index % bentoLayouts.length] ?? defaultLayout;
	}

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

<div class="flex min-h-screen flex-col bg-background text-foreground">
	<Topbar />

	<main id="main-content" class="flex-1">
		<div class="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
			<PublicPageHero
				class="mb-12"
				title="Our Blog"
				description="Plan your AP year, study smarter over the summer, and prep for exam day."
			/>

			{#if data.posts.length === 0}
				<div class="rounded-3xl bg-muted/50 px-8 py-16 text-center">
					<p class="text-muted-foreground">No posts yet — check back soon!</p>
				</div>
			{:else}
				<ul class="grid list-none auto-rows-fr grid-cols-1 gap-4 p-0 md:grid-cols-4 md:gap-5">
					{#each orderedPosts as post, index (post._id)}
						{@const layout = getLayout(index)}
						<li class="min-h-0 {layout.gridClass}">
							<a
								href={resolve(`/blog/${post.slug}`)}
								class="group flex h-full min-h-48 flex-col justify-between rounded-3xl p-6 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-7 {layout.class}"
							>
							<div class="space-y-3">
								<h2
									class="text-xl font-semibold leading-snug tracking-tight sm:text-2xl {layout.showExcerpt
										? 'max-w-md'
										: ''}"
								>
									{post.title}
								</h2>

								{#if layout.showExcerpt && post.excerpt}
									<p class="line-clamp-3 max-w-md text-sm leading-relaxed opacity-80">
										{post.excerpt}
									</p>
								{/if}
							</div>

							<div class="mt-6 flex items-center justify-between gap-4">
								{#if layout.showExcerpt}
									<span
										class="inline-flex items-center gap-1.5 text-sm font-medium transition-opacity group-hover:opacity-80"
									>
										Read More
										<ArrowRightIcon class="size-4 transition-transform group-hover:translate-x-0.5" />
									</span>
								{/if}

								<time
									class="ml-auto text-xs opacity-60"
									datetime={post.publishedAt ?? post.createdAt}
								>
									{formatDate(post.publishedAt ?? post.createdAt)}
								</time>
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
