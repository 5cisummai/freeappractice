<script lang="ts">
	import { onMount } from 'svelte';
	import { themeController } from '#lib/client/theme.svelte.js';
	import { HalftoneCMYK } from '@devmischief/shaders-svelte';

	let isDark = $state(false);

	onMount(() => {
		const root = document.documentElement;
		const syncTheme = () => {
			isDark = root.classList.contains('dark');
		};

		syncTheme();
		const observer = new MutationObserver(syncTheme);
		observer.observe(root, { attributes: true, attributeFilter: ['class'] });

		return () => observer.disconnect();
	});

	const image = $derived(isDark ? '/hero-bg-dark.webp' : '/hero-bg.webp');
</script>

<svelte:boundary>
	<HalftoneCMYK
		width="100%"
		height="100%"
		{image}
		class="absolute inset-0 size-full"
		colorBack={themeController.halloween
			? isDark
				? '#160d20'
				: '#faf0e5'
			: isDark
				? '#080b14'
				: '#fbfaf4'}
		colorC={themeController.halloween ? '#ea580c' : '#2563eb'}
		colorM={themeController.halloween ? '#7c3aed' : '#8b5cf6'}
		colorY={themeController.halloween ? '#f59e0b' : '#f4b740'}
		colorK={themeController.halloween ? '#3b164f' : '#1e3a8a'}
		type="ink"
		size={0.12}
		gridNoise={0.08}
		softness={0.65}
		contrast={1.05}
		gainC={0.18}
		gainM={0.08}
		gainY={0.1}
		gainK={0.04}
		grainMixer={0.02}
		grainOverlay={0.03}
		grainSize={0.5}
		minPixelRatio={1}
		fit="cover"
	/>

	{#snippet failed()}
		{#if themeController.halloween}
			<div
				class="size-full bg-linear-to-br from-orange-300 via-orange-100 to-purple-300 dark:from-orange-950 dark:via-purple-950 dark:to-slate-950"
			></div>
		{:else}
			<img src={image} alt="" class="size-full object-cover" />
		{/if}
	{/snippet}
</svelte:boundary>
