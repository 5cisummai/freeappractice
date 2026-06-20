<script lang="ts">
	import AppSidebar from '$lib/components/app-sidebar.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { SidebarTrigger } from '$lib/components/ui/sidebar/index.js';

	let { data, children } = $props();
</script>

<svelte:head>
	<meta name="robots" content="noindex, nofollow" />
	<meta name="googlebot" content="noindex, nofollow" />
	<link rel="canonical" href="https://freeappractice.org/app" />
</svelte:head>

<Sidebar.Provider>
	<AppSidebar user={data.user} />
	<Sidebar.Inset>
		<header class="flex h-14 shrink-0 items-center gap-2 px-4">
			<SidebarTrigger class="-ml-1" />
		</header>

		{@render children()}
	</Sidebar.Inset>
</Sidebar.Provider>
