<script lang="ts">
	import PublicShell from '$lib/components/layout/public-shell.svelte';
	import PricingSection from '$lib/components/marketing/pricing-section.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Super | Free AP Practice</title>
	<meta
		name="description"
		content="Upgrade to Super for personalized AP tutoring, AI coaching, and actionable study insights."
	/>
</svelte:head>

<PublicShell showPricing={!data.superFreeBetaEnabled}>
	<main id="main-content" class="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
		{#if !data.superFreeBetaEnabled}
			<PricingSection asPage />
		{/if}
	</main>
</PublicShell>
