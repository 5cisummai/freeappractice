<script lang="ts">
	import { onMount } from 'svelte';
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import AppSidebar from '$lib/components/app-sidebar.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { SidebarTrigger } from '$lib/components/ui/sidebar/index.js';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
	import {
		captureAuthenticatedStudentReturnedIfNeeded,
		captureSignupCompleted
	} from '$lib/client/activation-analytics';
	import { identifyPostHogUser } from '$lib/client/posthog-analytics';

	let { data, children } = $props();

	onMount(() => {
		if (data.user) {
			identifyPostHogUser(data.user.id, { name: data.user.name });
			if (page.url.searchParams.get('signup') === 'google') {
				captureSignupCompleted('google');
				const url = new URL(page.url);
				url.searchParams.delete('signup');
				const appHref = `${resolve('/app')}${url.search}`;
				// The base path is resolved above; this only removes the one-time query marker.
				// eslint-disable-next-line svelte/no-navigation-without-resolve
				replaceState(appHref, page.state);
			}
			captureAuthenticatedStudentReturnedIfNeeded();
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
	<AppSidebar isAdmin={data.isAdmin} user={data.user} referral={data.referral} />
	<Sidebar.Inset>
		<header class="sticky top-0 z-10 flex shrink-0 items-center gap-2 p-4">
			<SidebarTrigger />
		</header>

		<main id="main-content" class="flex-1">
			{@render children()}
		</main>
	</Sidebar.Inset>
</Sidebar.Provider>
