<script lang="ts">
	import PublicShell from '$lib/components/layout/public-shell.svelte';

	let { data, children } = $props();
</script>

<PublicShell showPricing={!data.superFreeBetaEnabled}>
	{@render children()}
</PublicShell>
