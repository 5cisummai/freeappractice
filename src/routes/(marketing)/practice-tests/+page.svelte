<script lang="ts">
	import ArrowRightIcon from '@tabler/icons-svelte/icons/arrow-right';
	import BookOpenCheckIcon from '@tabler/icons-svelte/icons/book-filled';
	import ExternalLinkIcon from '@tabler/icons-svelte/icons/external-link-filled';
	import { resolve } from '$app/paths';
	import { getClassPracticePages } from '$lib/catalog/practice-pages.js';
	import { Badge } from '$lib/components/ui/badge/index.js';

	const subjects = getClassPracticePages();

	const officialResources = [
		{
			label: 'College Board: How to Practice for AP Exams',
			href: 'https://apstudents.collegeboard.org/ap-exams-what-to-know/practice-for-exams',
			description:
				'Use this as the official starting point for AP Classroom, course exam pages, released questions, and Bluebook test previews.'
		},
		{
			label: 'AP Courses and Exams on AP Central',
			href: 'https://apcentral.collegeboard.org/courses',
			description:
				'Open your course page and look for exam preparation materials, including course-specific exam information and past FRQs.'
		},
		{
			label: 'Practice on Bluebook',
			href: 'https://bluebook.collegeboard.org/students/prepare',
			description:
				'For digital AP Exams, Bluebook provides official test previews so you can practice the testing tools and format.'
		}
	] as const;

	const jsonLd = JSON.stringify({
		'@context': 'https://schema.org',
		'@type': 'CollectionPage',
		name: 'Free AP Practice Tests & Questions',
		description:
			'Practice AP-style multiple-choice questions by course and unit. Free, unlimited, and no signup required.',
		url: 'https://freeappractice.org/practice-tests',
		isAccessibleForFree: true,
		mainEntity: {
			'@type': 'ItemList',
			itemListElement: subjects.map((subject, index) => ({
				'@type': 'ListItem',
				position: index + 1,
				name: `${subject.className} Practice Test`,
				url: `https://freeappractice.org/practice/${subject.slug}`
			}))
		}
	});
	const jsonLdMarkup =
		'<script type="application/ld+json">' + jsonLd.replace(/</g, '\\u003c') + '</' + 'script>';
</script>

<svelte:head>
	<title>Free AP Practice Tests &amp; Questions</title>
	<meta
		name="description"
		content="Practice AP-style multiple-choice questions by course and unit. Free, unlimited, and no signup required."
	/>
	<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />
	<link rel="canonical" href="https://freeappractice.org/practice-tests" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://freeappractice.org/practice-tests" />
	<meta property="og:title" content="Free AP Practice Tests &amp; Questions" />
	<meta
		property="og:description"
		content="Practice AP-style multiple-choice questions by course and unit. Free, unlimited, and no signup required."
	/>
	<meta property="og:image" content="https://freeappractice.org/icon.png" />
	<meta property="og:site_name" content="FreeAPPractice.org" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Free AP Practice Tests &amp; Questions" />
	<meta
		name="twitter:description"
		content="Practice AP-style multiple-choice questions by course and unit. Free, unlimited, and no signup required."
	/>
	<meta name="twitter:image" content="https://freeappractice.org/icon.png" />
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html jsonLdMarkup}
</svelte:head>

<main id="main-content" class="flex-1">
	<div class="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
		<section class="mx-auto max-w-3xl text-center">
			<Badge variant="outline" class="mb-4 rounded-full px-4 py-1 text-sm font-normal">
				Full-length ones coming soon
			</Badge>
			<h1
				class="font-display text-4xl leading-[1.1] font-medium tracking-tight text-balance sm:text-5xl lg:text-6xl"
			>
				Free AP Practice Tests &amp; Questions
			</h1>
			<p class="mx-auto mt-5 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
				Practice AP-style multiple-choice questions by course and unit. Free, unlimited, and no
				signup required.
			</p>
			<div class="mt-8 flex flex-wrap justify-center gap-3">
				<a
					href={resolve('/subjects')}
					class="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
				>
					Browse all AP subjects
					<ArrowRightIcon class="size-4" />
				</a>
				<a
					href="#courses"
					class="inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
				>
					Choose a course
				</a>
			</div>
		</section>

		<section id="courses" class="mt-16 scroll-mt-8 sm:mt-20" aria-labelledby="courses-heading">
			<div class="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h2 id="courses-heading" class="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
						Choose an AP course
					</h2>
				</div>
				<p class="max-w-md text-sm leading-6 text-muted-foreground sm:text-right">
					Every course hub below opens a working practice session with unit and mixed-unit options.
				</p>
			</div>

			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{#each subjects as subject (subject.slug)}
					<article
						class="group flex flex-col rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted/20"
					>
						<a
							href={resolve(`/practice/${subject.slug}`)}
							class="flex items-start justify-between gap-4"
						>
							<div>
								<h3 class="text-lg font-semibold tracking-tight group-hover:text-primary">
									{subject.className} Practice Test
								</h3>
								<p class="mt-2 text-sm leading-6 text-muted-foreground">
									Test yourself with AP-style multiple-choice questions across the {subject.className}
									curriculum.
								</p>
							</div>
							<ArrowRightIcon
								class="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
							/>
						</a>
					</article>
				{/each}
			</div>
		</section>

		<section
			class="mx-auto mt-16 max-w-3xl rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:mt-20 sm:p-8"
		>
			<div class="flex gap-4">
				<BookOpenCheckIcon class="mt-1 size-6 shrink-0 text-primary" />
				<div class="space-y-3">
					<h2 class="text-xl font-semibold tracking-tight sm:text-2xl">
						What do we mean by “AP practice test”?
					</h2>
					<p class="text-sm leading-7 text-muted-foreground sm:text-base">
						Here, a practice test is a flexible session of AP-style multiple-choice questions. You
						can practice one unit, mix units, and keep going for as many questions as you want.
						These sessions are not timed, full-length simulated AP exams, so use the official
						resources below when you need to rehearse the complete exam experience.
					</p>
				</div>
			</div>
		</section>

		<article class="prose prose-neutral dark:prose-invert mx-auto mt-16 max-w-3xl sm:mt-20">
			<h2>Where to find full-length AP practice resources</h2>
			<p>
				For a full-length or closest-to-official AP exam rehearsal, start with College Board. The
				best resource depends on what you are trying to practice: the complete digital testing
				experience, released questions, or feedback through your teacher.
			</p>
			<ul>
				{#each officialResources as resource (resource.href)}
					<li>
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
						<a href={resource.href} target="_blank" rel="noopener noreferrer">
							{resource.label}
							<ExternalLinkIcon class="ml-1 inline size-3.5" aria-hidden="true" />
						</a>
						<span class="block text-sm text-muted-foreground">{resource.description}</span>
					</li>
				{/each}
			</ul>
			<p>
				A good study sequence is to use these course and unit sessions throughout the year, then
				take an official released or Bluebook practice assessment under realistic timing before exam
				day. That gives you both repeated skill practice and a more honest check of pacing and
				endurance.
			</p>
		</article>
	</div>
</main>
