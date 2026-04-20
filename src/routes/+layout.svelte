<script lang="ts">
	import './layout.css';
	import 'katex/dist/katex.min.css';
	/* hljs light theme (default); dark overrides are in layout.css under .dark */
	import 'highlight.js/styles/github.min.css';
	import logo from '$lib/assets/logo.png';
	import { ModeWatcher } from 'mode-watcher';

	const PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN = import.meta.env.PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN;

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={logo} />
	{#if PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN}
		<!-- External beacon only (nonce applied by SvelteKit CSP). Disable Cloudflare “automatic” HTML injection for this hostname to avoid duplicate beacons / inline script CSP violations. -->
		<script
			defer
			src={`https://static.cloudflareinsights.com/beacon.min.js?token=${PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN}`}
		></script>
	{/if}
</svelte:head>
<ModeWatcher />
{@render children()}
