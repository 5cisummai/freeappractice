<script lang="ts">
	import { onMount } from 'svelte';
	import {
		loadHalftoneUniforms,
		tryCreateShaderMount
	} from '#lib/components/marketing/halftone-shader.js';
	import type { ShaderMount } from '@paper-design/shaders';

	let isDark = $state(false);
	let host = $state<HTMLDivElement | undefined>(undefined);
	let shaderVisible = $state(false);

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

	$effect(() => {
		const parent = host;
		const imageSrc = image;
		const dark = isDark;
		if (!parent) return;

		let cancelled = false;
		let shader: ShaderMount | null = null;

		void (async () => {
			const uniforms = await loadHalftoneUniforms(imageSrc, dark);
			if (cancelled || !uniforms) return;

			shader = tryCreateShaderMount(parent, uniforms);
			if (cancelled) {
				shader?.dispose();
				return;
			}
			shaderVisible = shader !== null;
		})();

		return () => {
			cancelled = true;
			shader?.dispose();
			shaderVisible = false;
		};
	});
</script>

<div class="absolute inset-0 size-full">
	<img src={image} alt="" class="size-full object-cover" />
	<div bind:this={host} class="absolute inset-0 size-full" class:invisible={!shaderVisible}></div>
</div>
