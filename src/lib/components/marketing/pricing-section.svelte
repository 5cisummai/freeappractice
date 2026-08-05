<script lang="ts">
	import PricingCards from '$lib/components/marketing/pricing-cards.svelte';
	import { twAnimateInView } from '$lib/tw-animate';

	let { asPage = false }: { asPage?: boolean } = $props();
</script>

<section
	class="mx-auto w-full max-w-6xl space-y-10 {twAnimateInView}"
	aria-labelledby="pricing-section-heading"
>
	<div class="mx-auto max-w-2xl space-y-5 text-center">
		<p class="text-sm font-semibold tracking-wide text-primary uppercase">Free AP Practice Super</p>
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

	<PricingCards />

	<p class="mx-auto max-w-2xl text-center text-sm leading-6 text-muted-foreground">
		No free trial, promotions, referral discounts, or overages. Cancel at the end of your billing
		period and restore before it ends. Personalized features require confirmation that you are 13 or
		older.
	</p>
</section>
