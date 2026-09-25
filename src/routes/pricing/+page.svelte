<script lang="ts">
	import PublicShell from '$lib/components/layout/public-shell.svelte';
	import PricingSection from '$lib/components/marketing/pricing-section.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Pricing | Free AP Practice</title>
	<meta
		name="description"
		content={data.superFreeBetaEnabled
			? 'Practice AP questions and study with Free AP Practice at no cost.'
			: 'Get free AP tutoring for every question. Upgrade to Super for AI Coach and weekly study plans.'}
	/>
</svelte:head>

<PublicShell showPricing={!data.superFreeBetaEnabled}>
	<main
		id="main-content"
		class={[
			'mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 lg:py-24',
			data.superFreeBetaEnabled && 'flex flex-1 flex-col justify-center'
		]}
	>
		{#if !data.superFreeBetaEnabled}
			<PricingSection asPage />
		{:else}
			<div class="mx-auto max-w-2xl text-center">
				<h1 class="text-4xl font-bold tracking-tight sm:text-5xl">Pricing is free</h1>
				<p class="mt-5 text-lg text-muted-foreground">
					Free AP Practice is free to use, including Super features during the free beta.
				</p>
			</div>
		{/if}
	</main>
</PublicShell>
