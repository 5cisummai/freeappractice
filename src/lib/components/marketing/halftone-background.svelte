<script lang="ts">
	import { onMount } from 'svelte';
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
		colorBack={isDark ? '#080b14' : '#fbfaf4'}
		colorC="#2563eb"
		colorM="#8b5cf6"
		colorY="#f4b740"
		colorK="#1e3a8a"
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
		<img src={image} alt="" class="size-full object-cover" />
	{/snippet}
</svelte:boundary>
