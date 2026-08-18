<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button/index.js';
	import SuperLandingSection from '$lib/components/marketing/super-landing-section.svelte';
	import { SUPER_GRADIENT_BUTTON_CLASS } from '$lib/super/ui';
	import { twAnimateIn, twAnimateInView } from '$lib/tw-animate';
	import ArrowRightIcon from '@tabler/icons-svelte/icons/arrow-right';
	import SparklesIcon from '@tabler/icons-svelte/icons/sparkles-filled';

	let { data } = $props();

	const signupHref = `${resolve('/signup')}?super=1`;
</script>

<svelte:head>
	<title>Super | Personalized AP Tutoring | Free AP Practice</title>
	<meta
		name="description"
		content="Super adds a personalized tutor, AI Coach, actionable insights, and weekly study plans built around your AP practice history."
	/>
	<link rel="canonical" href="https://freeappractice.org/super" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://freeappractice.org/super" />
	<meta property="og:title" content="Super | Personalized AP Tutoring" />
	<meta
		property="og:description"
		content="Personalized MCQ and FRQ tutoring, AI Coach, insights, and weekly study plans for AP students."
	/>
	<meta property="og:image" content="https://freeappractice.org/icon.png" />
	<meta property="og:site_name" content="FreeAPPractice.org" />
	<meta property="og:locale" content="en_US" />
</svelte:head>

<main id="main-content" class="flex-1">
	<div
		class="mx-auto w-full max-w-7xl space-y-24 px-5 py-12 sm:px-8 lg:space-y-32 lg:px-10 lg:py-20"
	>
		<section class="relative mx-auto max-w-4xl text-center" id="hero">
			<div class="mx-auto max-w-2xl space-y-6">
				<div class="space-y-4">
					<h1
						class="{twAnimateIn} font-display text-4xl leading-[1.1] font-medium tracking-tight text-balance delay-100 sm:text-5xl lg:text-[3.25rem]"
					>
						Your AP prep,
						<span
							class="bg-linear-to-r from-violet-600 via-fuchsia-500 to-cyan-500 bg-clip-text text-transparent dark:from-violet-300 dark:via-fuchsia-300 dark:to-cyan-300"
						>
							supercharged.
						</span>
					</h1>
					<p
						class="mx-auto max-w-lg text-base leading-7 text-muted-foreground delay-200 sm:text-lg {twAnimateIn}"
					>
						Tutor, Coach, insights, and weekly plans—personalized from your practice.
					</p>
				</div>

				<div class="flex flex-wrap items-center justify-center gap-3 delay-300 {twAnimateIn}">
					{#if data.superFreeBetaEnabled}
						<Button
							href={signupHref}
							size="lg"
							class="rounded-full px-7 {SUPER_GRADIENT_BUTTON_CLASS}"
						>
							Claim free Super
							<ArrowRightIcon class="size-4" />
						</Button>
					{:else}
						<Button
							href={resolve('/pricing')}
							size="lg"
							class="rounded-full px-7 {SUPER_GRADIENT_BUTTON_CLASS}"
						>
							Get Super
							<ArrowRightIcon class="size-4" />
						</Button>
					{/if}
					<Button href={resolve('/signup')} variant="outline" size="lg" class="rounded-full px-6">
						Start practicing free
					</Button>
				</div>
			</div>
		</section>

		<SuperLandingSection freeBeta={data.superFreeBetaEnabled} />

		<section
			class="relative mx-auto w-full max-w-3xl overflow-hidden rounded-3xl border-2 border-violet-300/50 super-tier-gradient p-8 text-center shadow-lg shadow-violet-500/15 sm:p-10 {twAnimateInView}"
		>
			<div
				aria-hidden="true"
				class="pointer-events-none absolute -top-16 right-0 h-40 w-40 rounded-full bg-fuchsia-500/20 blur-3xl"
			></div>
			<p
				class="inline-flex items-center gap-1.5 rounded-full border border-violet-300/50 bg-background/70 px-3 py-1 text-xs font-semibold text-violet-700 shadow-sm dark:text-violet-300"
			>
				<SparklesIcon class="size-3.5" aria-hidden="true" />
				{#if data.superFreeBetaEnabled}
					Limited-time free beta
				{:else}
					Upgrade anytime
				{/if}
			</p>
			<h2 class="mt-5 font-display text-3xl font-medium tracking-tight text-balance sm:text-4xl">
				{#if data.superFreeBetaEnabled}
					Claim Super free while the beta lasts.
				{:else}
					Make every practice session count.
				{/if}
			</h2>
			<p class="mx-auto mt-3 max-w-xl text-base leading-7 text-muted-foreground">
				{#if data.superFreeBetaEnabled}
					Get personalized tutoring, Coach, insights, and weekly study plans with 300 messages per
					month—free during the Super beta.
				{:else}
					Add personalized tutoring, Coach, insights, and weekly study plans on top of unlimited
					free practice.
				{/if}
			</p>
			<div class="mt-7 flex flex-wrap items-center justify-center gap-3">
				{#if data.superFreeBetaEnabled}
					<Button
						href={signupHref}
						size="lg"
						class="rounded-full px-7 {SUPER_GRADIENT_BUTTON_CLASS}"
					>
						Claim free Super
						<ArrowRightIcon class="size-4" />
					</Button>
				{:else}
					<Button
						href={resolve('/pricing')}
						size="lg"
						class="rounded-full px-7 {SUPER_GRADIENT_BUTTON_CLASS}"
					>
						View pricing
						<ArrowRightIcon class="size-4" />
					</Button>
				{/if}
				<Button href={resolve('/subjects')} variant="outline" size="lg" class="rounded-full px-6">
					Browse subjects
				</Button>
			</div>
		</section>
	</div>
</main>
