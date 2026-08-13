<script lang="ts">
	import PricingCards from '$lib/components/marketing/pricing-cards.svelte';
	import SectionIntro from '$lib/components/marketing/section-intro.svelte';
	import { twAnimateInView } from '$lib/tw-animate';

	let { asPage = false }: { asPage?: boolean } = $props();
</script>

<section
	class="mx-auto w-full max-w-7xl space-y-10 {twAnimateInView}"
	aria-labelledby="pricing-section-heading"
>
	<SectionIntro
		id="pricing-section-heading"
		headingLevel={asPage ? 'h1' : 'h2'}
		titleClass="font-display leading-tight font-medium tracking-tight text-balance {asPage
			? 'text-4xl sm:text-5xl'
			: 'text-3xl sm:text-4xl'}"
	>
		{#snippet title()}
			A tutor that learns how you learn.
		{/snippet}
		{#snippet description()}
			<p>
				A personalized tutor for your learning style and a coach that guides you to your best scores.
			</p>
		{/snippet}
	</SectionIntro>

	<PricingCards />

	<p class="mx-auto max-w-2xl text-center text-sm leading-6 text-muted-foreground">
		Must be 13+ to use personalized features. No free trials or promotional pricing. Cancel anytime
		before your next renewal.
	</p>
</section>
