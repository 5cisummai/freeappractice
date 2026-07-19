<script lang="ts">
	import PublicPageHero from '$lib/components/marketing/public-page-hero.svelte';
	import BackToHome from '$lib/components/layout/back-to-home.svelte';
	import InviteBanner from '$lib/components/marketing/invite-banner.svelte';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import { resolve } from '$app/paths';
	import { getClassPracticePages } from '$lib/catalog/practice-pages.js';

	const subjects = getClassPracticePages();
</script>

<svelte:head>
	<title>AP Subjects – Free AP Practice</title>
	<meta
		name="description"
		content="Browse all supported AP subjects and jump straight to free practice questions for each course—20+ classes, unlimited MCQs, instant feedback, no signup."
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

<main id="main-content" class="mx-auto w-full max-w-4xl flex-1 px-5 py-12 sm:px-8">
	<BackToHome />

	<InviteBanner />

	<PublicPageHero
		class="mt-6"
		align="start"
		title="AP Subjects"
		description="Every supported AP course in one place: open a subject hub, pick a unit, and start practicing in two clicks."
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

	<section class="mt-8 space-y-4 text-base leading-7 text-muted-foreground">
		<p>
			Free AP Practice covers more than twenty College Board courses, from AP Biology and AP US
			History to AP Calculus, AP Physics, economics, languages, and computer science. Each subject
			page is a hub: you will see the full unit list your teacher likely follows, plus quick access
			to generate unlimited multiple-choice questions with instant explanations.
		</p>
		<p>
			You do not need an account to start. Pick the class you are taking (or one you are considering
			for next year), open its practice page, choose a unit, and hit Generate. Wrong answers are as
			useful as right ones when you read the feedback immediately; that is how the site is built to
			work.
		</p>
		<p>
			If you are planning a schedule, browsing subjects here is faster than guessing what is
			supported. Every link below goes to a dedicated hub with exam-aligned context, study tips, and
			helpful resources where we have them. Start with the course on your desk today, or preview
			Unit 1 for a class you might take in the fall.
		</p>
		<p>
			Looking for something specific? Use your browser search on this page, or open a subject and
			use the unit navigation there. New courses and units get added as the College Board updates
			syllabi and as students ask for coverage; this list is the canonical map of what you can
			practice today.
		</p>
	</section>
</main>
