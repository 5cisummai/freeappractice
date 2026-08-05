<script lang="ts">
	import Topbar from '$lib/components/layout/topbar.svelte';
	import SiteFooter from '$lib/components/layout/site-footer.svelte';
	import PricingSection from '$lib/components/marketing/pricing-section.svelte';
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
	<PricingSection asPage />
</main>

<SiteFooter />
