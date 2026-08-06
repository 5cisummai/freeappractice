<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button/index.js';
	import PricingCards from '$lib/components/marketing/pricing-cards.svelte';
	import { twAnimateInView } from '$lib/tw-animate';

	let { asPage = false, freeBeta = false }: { asPage?: boolean; freeBeta?: boolean } = $props();
</script>

<section
	class="mx-auto w-full max-w-6xl space-y-10 {twAnimateInView}"
	aria-labelledby="pricing-section-heading"
>
	<div class="mx-auto max-w-2xl space-y-5 text-center">
		<svelte:element
			this={asPage ? 'h1' : 'h2'}
			id="pricing-section-heading"
			class="font-display leading-tight font-medium tracking-tight text-balance {asPage
				? 'text-4xl sm:text-5xl'
				: 'text-3xl sm:text-4xl'}"
		>
			A tutor that learns how you learn.
		</svelte:element>
		<p class="mx-auto max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
			A personalized tutor for your learning style and a coach that guides you to your best scores.
		</p>
	</div>

	{#if freeBeta}
		<div
			class="mx-auto max-w-2xl rounded-3xl border-2 border-violet-300/50 super-tier-gradient p-8 text-center shadow-sm shadow-violet-500/10"
		>
			<span
				class="inline-flex rounded-full border border-violet-300/50 bg-background/70 px-3 py-1 text-xs font-semibold text-violet-700 shadow-sm dark:text-violet-300"
			>
				Super beta
			</span>
			<h2 class="mt-4 font-display text-3xl font-medium tracking-tight">
				Claim your free Super offer.
			</h2>
			<p class="mx-auto mt-3 max-w-xl text-base leading-7 text-muted-foreground">
				Unlock personalized tutoring, AI Coach, insights, weekly study plans, and 300 personalized
				messages per UTC calendar month — free during the Super beta.
			</p>
			<Button href={resolve('/signup')} size="lg" class="mt-6 rounded-full px-6">
				Claim free Super
			</Button>
		</div>
	{:else}
		<PricingCards />

		<p class="mx-auto max-w-2xl text-center text-sm leading-6 text-muted-foreground">
			Must be 13+ to use personalized features. No free trials, promotions, or overages. Cancel
			anytime before your billing period ends.
		</p>
	{/if}
</section>
