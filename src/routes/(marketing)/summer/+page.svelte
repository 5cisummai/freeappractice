<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { HERO_BADGE_CLASS } from '$lib/components/marketing/hero-badge.js';
	import BackToHome from '$lib/components/layout/back-to-home.svelte';
	import { resolve } from '$app/paths';

	const weeklyPlan = [
		{
			week: 'Week 1',
			title: 'Set up',
			detail:
				'Confirm your AP subject, skim the Unit 1 outline, and try a handful of practice questions.'
		},
		{
			week: 'Week 2',
			title: 'Learn Unit 1',
			detail:
				'Alternate reading or videos with short practice sets—focus on understanding, not volume.'
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

	type ResourcePath =
		'/blog/which-aps-to-take' | '/blog/summer-ap-study-plan' | '/blog/science-of-studying';

	const resources: Array<{ href: ResourcePath; title: string; description: string }> = [
		{
			href: '/blog/which-aps-to-take',
			title: 'Which APs should you take?',
			description: 'Choose classes that fit your goals and schedule—not every AP on the list.'
		},
		{
			href: '/blog/summer-ap-study-plan',
			title: 'Summer AP study plan',
			description: 'A realistic 4-week preview schedule with daily pacing.'
		},
		{
			href: '/blog/science-of-studying',
			title: 'The science of studying',
			description: 'Why short, spaced practice beats cramming—especially before the school year.'
		}
	];

	function goToPractice() {
		window.location.href = resolve('/');
	}
</script>

<svelte:head>
	<title>Summer AP Study Guide | Plan & Preview Before School Starts</title>
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
	<meta property="og:title" content="Summer AP Study Guide | Free AP Practice" />
	<meta
		property="og:description"
		content="Plan your AP year and preview Unit 1 this summer with free practice questions and study guides."
	/>
	<meta property="og:image" content="https://freeappractice.org/icon.png" />
	<meta property="og:site_name" content="FreeAPPractice.org" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Summer AP Study Guide | Free AP Practice" />
	<meta
		name="twitter:description"
		content="Plan your AP year and preview Unit 1 this summer with free practice questions."
	/>
	<meta name="twitter:image" content="https://freeappractice.org/icon.png" />
</svelte:head>

<div class="flex min-h-screen flex-col bg-background text-foreground">
	<main id="main-content" class="flex-1">
		<div class="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 lg:py-16">
			<div class="flex items-start justify-center gap-10">
				<article class="w-full max-w-3xl min-w-0">
					<BackToHome label="Back to practice" class="mb-8" />

					<header class="mb-10 space-y-4">
						<Badge variant="outline" class={HERO_BADGE_CLASS}>
							Study guide
						</Badge>

						<h1
							class="font-display text-4xl leading-[1.12] font-medium tracking-tight text-balance sm:text-5xl"
						>
							Summer AP Study Guide
						</h1>

						<p class="text-base leading-8 text-muted-foreground sm:text-lg">
							Whether you're picking your first AP, starting high school, or previewing a class
							before September, use summer for planning and Unit 1—not cramming the whole course.
						</p>
					</header>

					<div
						class="max-w-none font-serif text-base leading-[1.75] text-foreground [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-[3px] [&_a:hover]:opacity-80 [&_h1]:mt-[2em] [&_h1]:mb-3 [&_h1]:font-semibold [&_h1]:tracking-[-0.025em] [&_h2]:mt-[2em] [&_h2]:mb-3 [&_h2]:text-[1.5em] [&_h2]:font-semibold [&_h2]:tracking-[-0.025em] [&_h3]:mt-[2em] [&_h3]:mb-3 [&_h3]:text-[1.25em] [&_h3]:font-semibold [&_h3]:tracking-[-0.025em] [&_h4]:mt-[2em] [&_h4]:mb-3 [&_h4]:text-[1.1em] [&_h4]:font-semibold [&_h4]:tracking-[-0.025em] [&_hr]:my-[2em] [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-border [&_li]:mb-[0.4em] [&_ol]:mb-5 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mt-0 [&_p]:mb-5 [&_ul]:mb-5 [&_ul]:list-disc [&_ul]:pl-6"
					>
						<h2>Who this is for</h2>
						<p>
							This guide is meant for students who want a light, realistic summer routine—not a
							full-course sprint before school starts.
						</p>
						<ul>
							<li>Students choosing AP classes for next year</li>
							<li>Rising sophomores and juniors taking their first AP</li>
							<li>Anyone previewing Unit 1 before school starts</li>
							<li>Summer self-studiers who want low-pressure practice</li>
						</ul>

						<h2>Daily habit (about 20 minutes)</h2>
						<p>
							Consistency matters more than long sessions. A short daily block is enough to build
							familiarity with the subject and the exam format.
						</p>
						<ol>
							<li>Pick your AP subject and Unit 1 on the home page.</li>
							<li>Generate a few questions—no timer required.</li>
							<li>Read explanations and note one topic to revisit tomorrow.</li>
						</ol>

						<h2>4-week preview outline</h2>
						<p>
							Repeat or shorten this plan to match your summer. For daily pacing and more detail,
							see the
							<a href={resolve('/blog/summer-ap-study-plan')}>full study plan post</a>.
						</p>

						{#each weeklyPlan as item (item.week)}
							<h3>{item.week}: {item.title}</h3>
							<p>{item.detail}</p>
						{/each}

						<hr />

						<p>
							Ready to try a question? Select an AP class, choose Unit 1, and generate your first
							practice question—free, no signup.
							<a href={resolve('/')}>Go to practice</a>.
						</p>
					</div>
				</article>

				<aside class="hidden w-64 shrink-0 lg:sticky lg:top-8 lg:block lg:self-start xl:w-72">
					<div class="flex flex-col gap-4">
						<div class="rounded-xl border border-border/60 bg-card p-4">
							<p
								class="mb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
							>
								Free AP Practice
							</p>
							<p class="mb-2 text-xs text-muted-foreground">No signup required</p>
							<h2 class="mb-3 text-sm leading-snug font-semibold text-foreground">
								Start with Unit 1
							</h2>
							<button
								onclick={goToPractice}
								class="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 active:opacity-80"
							>
								Start practicing →
							</button>
						</div>

						<div class="rounded-xl border border-border/60 bg-card p-4">
							<p
								class="mb-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
							>
								Related reading
							</p>
							<ul class="flex flex-col gap-1.5">
								{#each resources as link (link.href)}
									<li>
										<a
											href={resolve(link.href)}
											class="block rounded-md px-2 py-1.5 text-sm text-foreground/80 transition-colors hover:bg-muted/50 hover:text-foreground"
										>
											{link.title}
										</a>
									</li>
								{/each}
							</ul>
						</div>

						<div class="rounded-xl border border-border/60 bg-card p-4">
							<p
								class="mb-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
							>
								About
							</p>
							<p class="text-xs leading-relaxed text-muted-foreground">
								FreeAPPractice.org helps high school students plan AP classes, preview coursework
								over the summer, and practice with instant feedback—always free.
							</p>
						</div>
					</div>
				</aside>
			</div>
		</div>
	</main>
</div>
