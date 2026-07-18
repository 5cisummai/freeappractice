<script lang="ts">
	import Topbar from '$lib/components/layout/topbar.svelte';
	import SiteFooter from '$lib/components/layout/site-footer.svelte';

	let { children } = $props();
</script>

<div class="flex min-h-screen flex-col bg-background text-foreground">
	<Topbar />
	{@render children()}
	<SiteFooter />
</div>
