<script lang="ts">
	import Topbar from '$lib/components/topbar.svelte';
	import SiteFooter from '$lib/components/site-footer.svelte';
	import PublicPageHero from '$lib/components/public-page-hero.svelte';
	import BackToHome from '$lib/components/back-to-home.svelte';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import { resolve } from '$app/paths';
	import { getClassPracticePages } from '$lib/practice-pages.js';

	const subjects = getClassPracticePages();
</script>

<svelte:head>
	<title>AP Subjects – Free AP Practice</title>
	<meta
		name="description"
		content="Browse all supported AP subjects and jump straight to free practice questions for each course."
	/>
	<link rel="canonical" href="https://freeappractice.org/subjects" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://freeappractice.org/subjects" />
	<meta property="og:title" content="AP Subjects – Free AP Practice" />
	<meta
		property="og:description"
		content="Browse all supported AP subjects and jump straight to free practice questions for each course."
	/>
	<meta property="og:image" content="https://freeappractice.org/icon.png" />
	<meta property="og:site_name" content="FreeAPPractice.org" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="AP Subjects – Free AP Practice" />
	<meta
		name="twitter:description"
		content="Browse all supported AP subjects and jump straight to free practice questions for each course."
	/>
	<meta name="twitter:image" content="https://freeappractice.org/icon.png" />
</svelte:head>

<div class="flex min-h-screen flex-col bg-background text-foreground">
	<Topbar />

	<main id="main-content" class="mx-auto w-full max-w-4xl flex-1 px-5 py-12 sm:px-8">
		<BackToHome />

		<PublicPageHero
			class="mt-6"
			align="start"
			title="AP Subjects"
			description="Pick a subject to open its practice hub. Each page lets you generate unlimited questions by unit, free, no signup."
		/>

		<section class="mt-10">
			<ul class="grid gap-3 sm:grid-cols-2">
				{#each subjects as subject (subject.slug)}
					<li>
						<a
							href={resolve(`/practice/${subject.slug}`)}
							class="group flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/40"
						>
							<span class="font-medium group-hover:text-primary">{subject.className}</span>
							<ArrowRightIcon
								class="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
							/>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	</main>

	<SiteFooter />
</div>
