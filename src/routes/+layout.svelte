<script lang="ts">
	import './layout.css';
	import 'katex/dist/katex.min.css';
	/* hljs light theme (default); dark overrides are in layout.css under .dark */
	import 'highlight.js/styles/github.min.css';
	import logo from '$lib/assets/logo.png';
	import { ModeWatcher } from 'mode-watcher';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={logo} /></svelte:head>
<ModeWatcher />
{@render children()}
