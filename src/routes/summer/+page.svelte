<script lang="ts">
	import Topbar from '$lib/components/topbar.svelte';
	import SiteFooter from '$lib/components/site-footer.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import { resolve } from '$app/paths';

	const weeklyPlan = [
		{
			week: 'Week 1',
			title: 'Set up',
			detail: 'Confirm your AP subject, skim the Unit 1 outline, and try a handful of practice questions.'
		},
		{
			week: 'Week 2',
			title: 'Learn Unit 1',
			detail: 'Alternate reading or videos with short practice sets—focus on understanding, not volume.'
		},
		{
			week: 'Week 3',
			title: 'Practice retrieval',
			detail: 'Answer questions without notes half the time. Note topics you miss twice.'
		},
		{
			week: 'Week 4',
			title: 'Review & rest',
			detail: 'Light review only, then take a few days off before school starts.'
		}
	];

	const resources = [
		{
			href: resolve('/blog/which-aps-to-take'),
			title: 'Which APs should you take?',
			description: 'Choose classes that fit your goals and schedule—not every AP on the list.'
		},
		{
			href: resolve('/blog/summer-ap-study-plan'),
			title: 'Summer AP study plan',
			description: 'A realistic 4-week preview schedule with daily pacing.'
		},
		{
			href: resolve('/blog/science-of-studying'),
			title: 'The science of studying',
			description: 'Why short, spaced practice beats cramming—especially before the school year.'
		}
	];
</script>

<svelte:head>
	<title>Summer AP Study Guide – Plan & Preview Before School Starts</title>
	<meta
		name="description"
		content="Free summer AP prep for high school students: plan your AP classes, preview Unit 1, and practice 15–30 minutes a day with instant feedback. No signup required."
	/>
	<meta
		name="keywords"
		content="summer AP study, AP summer homework, preview AP class, rising sophomore AP, first AP class, high school summer study, AP course planning"
	/>
	<link rel="canonical" href="https://freeappractice.org/summer" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://freeappractice.org/summer" />
	<meta property="og:title" content="Summer AP Study Guide – Free AP Practice" />
	<meta
		property="og:description"
		content="Plan your AP year and preview Unit 1 this summer with free practice questions and study guides."
	/>
	<meta property="og:image" content="https://freeappractice.org/icon.png" />
	<meta property="og:site_name" content="FreeAPPractice.org" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Summer AP Study Guide – Free AP Practice" />
	<meta
		name="twitter:description"
		content="Plan your AP year and preview Unit 1 this summer with free practice questions."
	/>
	<meta name="twitter:image" content="https://freeappractice.org/icon.png" />
</svelte:head>

<div class="flex min-h-screen flex-col bg-background text-foreground">
	<Topbar />

	<main id="main-content" class="mx-auto w-full max-w-4xl flex-1 px-5 py-12 sm:px-8">
		<Button variant="ghost" href={resolve('/')}>
			<ArrowLeftIcon class="size-4" />
			Back to practice
		</Button>

		<section class="mt-6 space-y-4 text-center sm:text-left">
			<Badge variant="outline" class="mx-auto sm:mx-0">Summer &amp; new school year</Badge>
			<h1
				class="font-display text-balance text-3xl leading-[1.12] font-medium tracking-tight sm:text-4xl lg:text-5xl"
			>
				Get ahead on AP this summer—without burning out
			</h1>
			<p class="max-w-2xl text-base leading-relaxed text-muted-foreground">
				Whether you're picking your first AP, starting high school, or previewing a class before
				September, use summer for <strong class="text-foreground">planning</strong> and
				<strong class="text-foreground">Unit 1</strong>—not cramming the whole course.
			</p>
			<div class="flex flex-wrap justify-center gap-3 pt-2 sm:justify-start">
				<Button href={resolve('/')}>Start practicing</Button>
				<Button variant="outline" href={resolve('/blog/summer-ap-study-plan')}>
					Read the 4-week plan
					<ArrowRightIcon class="size-4" />
				</Button>
			</div>
		</section>

		<section class="mt-10 grid gap-6 sm:grid-cols-2">
			<article class="rounded-xl border border-border bg-card p-6">
				<h2 class="text-xl font-semibold text-primary">Who this is for</h2>
				<ul class="mt-3 space-y-2 text-sm text-muted-foreground">
					<li>Students choosing AP classes for next year</li>
					<li>Rising sophomores and juniors taking their first AP</li>
					<li>Anyone previewing Unit 1 before school starts</li>
					<li>Summer self-studiers who want low-pressure practice</li>
				</ul>
			</article>
			<article class="rounded-xl border border-border bg-card p-6">
				<h2 class="text-xl font-semibold text-primary">Daily habit (about 20 min)</h2>
				<ol class="mt-3 list-inside list-decimal space-y-2 text-sm text-muted-foreground">
					<li>Pick your AP subject and Unit 1 on the home page.</li>
					<li>Generate a few questions—no timer required.</li>
					<li>Read explanations and note one topic to revisit tomorrow.</li>
				</ol>
			</article>
		</section>

		<section class="mt-10">
			<h2 class="text-2xl font-semibold tracking-tight">4-week preview outline</h2>
			<p class="mt-2 text-sm text-muted-foreground">
				Repeat or shorten this plan to match your summer. Details and pacing tips are in the
				<a href={resolve('/blog/summer-ap-study-plan')} class="underline underline-offset-2"
					>full study plan post</a
				>.
			</p>
			<div class="mt-6 grid gap-4 sm:grid-cols-2">
				{#each weeklyPlan as item (item.week)}
					<div class="rounded-xl border border-border/70 bg-card p-5">
						<p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
							{item.week}
						</p>
						<h3 class="mt-1 text-lg font-semibold">{item.title}</h3>
						<p class="mt-2 text-sm leading-relaxed text-muted-foreground">{item.detail}</p>
					</div>
				{/each}
			</div>
		</section>

		<section class="mt-10 rounded-xl border border-border bg-card p-6">
			<h2 class="text-2xl font-semibold text-primary">Start here</h2>
			<ul class="mt-4 space-y-4">
				{#each resources as link (link.href)}
					<li>
						<a
							href={link.href}
							class="group block rounded-lg border border-border/60 p-4 transition-colors hover:bg-muted/40"
						>
							<p class="font-medium group-hover:text-primary">{link.title}</p>
							<p class="mt-1 text-sm text-muted-foreground">{link.description}</p>
						</a>
					</li>
				{/each}
			</ul>
		</section>

		<section class="mt-10 rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center">
			<h2 class="text-xl font-semibold">Ready to try a question?</h2>
			<p class="mt-2 text-sm text-muted-foreground">
				Select an AP class, choose Unit 1, and generate your first practice question—free, no signup.
			</p>
			<Button class="mt-4" href={resolve('/')}>Go to practice</Button>
		</section>
	</main>

	<SiteFooter />
</div>
