<script lang="ts">
	import type { Snippet } from 'svelte';
	import SiteFooter from './site-footer.svelte';
	import Topbar from './topbar.svelte';

	let { children, showPricing = true }: { children: Snippet; showPricing?: boolean } = $props();
</script>

<div class="relative isolate flex min-h-screen flex-col bg-background text-foreground">
	<Topbar {showPricing} />
	{@render children()}
	<SiteFooter />
</div>
