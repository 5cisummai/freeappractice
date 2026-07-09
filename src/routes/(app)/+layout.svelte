<script lang="ts">
	import { onMount } from 'svelte';
	import AppSidebar from '$lib/components/app-sidebar.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { SidebarTrigger } from '$lib/components/ui/sidebar/index.js';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
	import { identifyPostHogUser } from '$lib/client/posthog-analytics';

	let { data, children } = $props();

	onMount(() => {
		if (data.user) {
			identifyPostHogUser(data.user.email, { name: data.user.name });
		}
	});
</script>

<svelte:head>
	<meta name="robots" content="noindex, nofollow" />
	<meta name="googlebot" content="noindex, nofollow" />
	<link rel="canonical" href="https://freeappractice.org/app" />
</svelte:head>

<Toaster />

<Sidebar.Provider class="bg-sidebar">
	<AppSidebar isAdmin={data.isAdmin} user={data.user} />
	<Sidebar.Inset>
		<header class="sticky top-0 z-10 flex shrink-0 items-center gap-2 p-4">
			<SidebarTrigger />
		</header>

		<main id="main-content" class="flex-1">
			{@render children()}
		</main>
	</Sidebar.Inset>
</Sidebar.Provider>
