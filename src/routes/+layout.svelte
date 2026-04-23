<script lang="ts">
	import './layout.css';
	import 'katex/dist/katex.min.css';
	/* hljs light theme (default); dark overrides are in layout.css under .dark */
	import 'highlight.js/styles/github.min.css';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';
	import logo from '$lib/assets/logo.png';
	import { ModeWatcher } from 'mode-watcher';
	import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';

	let { children } = $props();
	injectAnalytics();
	injectSpeedInsights();
</script>

<svelte:head>
	<link rel="icon" href={logo} />
</svelte:head>
<ModeWatcher />
{@render children()}
