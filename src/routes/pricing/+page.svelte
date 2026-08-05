<script lang="ts">
	import { resolve } from '$app/paths';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import { Button } from '$lib/components/ui/button/index.js';
	import Topbar from '$lib/components/layout/topbar.svelte';
	import SiteFooter from '$lib/components/layout/site-footer.svelte';

	const freeFeatures = [
		'Unlimited AP multiple-choice practice',
		'Instant explanations, progress, history, and bookmarks',
		'Written-response practice and the standard AI tutor'
	];
	const superFeatures = [
		'Everything in Free',
		'Personalized MCQ and FRQ tutoring',
		'AI Coach with approval-based study-plan updates',
		'Actionable insights and weekly study plans',
		'600 personalized messages per UTC calendar month'
	];
</script>

<svelte:head>
	<title>Super – Free AP Practice</title>
	<meta
		name="description"
		content="Upgrade to Super for personalized AP tutoring, AI coaching, and actionable study insights."
	/>
</svelte:head>

<Topbar />

<main id="main-content" class="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
	<section class="mx-auto max-w-2xl text-center">
		<p class="text-sm font-semibold tracking-wide text-primary uppercase">Free AP Practice Super</p>
		<h1 class="mt-3 font-display text-4xl font-medium tracking-tight sm:text-5xl">
			A tutor that learns how you learn.
		</h1>
		<p class="mt-5 text-lg leading-8 text-muted-foreground">
			Keep every practice tool free. Upgrade only when you want a private tutoring profile, study
			coach, and deeper patterns from your own work.
		</p>
	</section>

	<section class="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
		<article class="rounded-3xl border border-border bg-card p-7 shadow-sm">
			<p class="text-sm font-semibold text-muted-foreground">Free</p>
			<h2 class="mt-2 font-display text-3xl font-medium">$0</h2>
			<p class="mt-1 text-sm text-muted-foreground">Always available</p>
			<ul class="mt-7 space-y-3 text-sm">
				{#each freeFeatures as feature (feature)}
					<li class="flex gap-2">
						<CheckIcon class="mt-0.5 size-4 shrink-0 text-primary" />{feature}
					</li>
				{/each}
			</ul>
			<Button href={resolve('/app/practice')} variant="outline" class="mt-8 w-full"
				>Keep practicing free</Button
			>
		</article>

		<article
			class="rounded-3xl border-2 border-primary bg-primary/5 p-7 shadow-lg shadow-primary/10"
		>
			<div class="flex items-start justify-between gap-3">
				<div>
					<p class="text-sm font-semibold text-primary">Super</p>
					<h2 class="mt-2 font-display text-3xl font-medium">
						$9.99 <span class="text-base text-muted-foreground">/ month</span>
					</h2>
				</div>
				<span
					class="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground"
					>Best value yearly</span
				>
			</div>
			<p class="mt-1 text-sm text-muted-foreground">or $79.99 yearly</p>
			<ul class="mt-7 space-y-3 text-sm">
				{#each superFeatures as feature (feature)}
					<li class="flex gap-2">
						<CheckIcon class="mt-0.5 size-4 shrink-0 text-primary" />{feature}
					</li>
				{/each}
			</ul>
			<Button href={resolve('/app/super/setup')} class="mt-8 w-full">
				Choose Super <ArrowRightIcon class="size-4" />
			</Button>
		</article>
	</section>

	<p class="mx-auto mt-8 max-w-2xl text-center text-sm leading-6 text-muted-foreground">
		No free trial, promotions, referral discounts, or overages. Cancel at the end of your billing
		period and restore before it ends. Personalized features require confirmation that you are 13 or
		older.
	</p>
</main>

<SiteFooter />
