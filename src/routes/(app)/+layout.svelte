<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { auth } from '$lib/client/auth.svelte.js';
	import AppSidebar from '$lib/components/app-sidebar.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { SidebarTrigger } from '$lib/components/ui/sidebar/index.js';

	let { children } = $props();

	onMount(() => {
		auth.init();
		if (!auth.isAuthenticated) {
			goto(resolve('/login'));
		}
	});
</script>

<svelte:head>
	<meta name="robots" content="noindex, nofollow" />
	<meta name="googlebot" content="noindex, nofollow" />
	<link rel="canonical" href="https://freeappractice.org/app" />
</svelte:head>

{#if auth.isAuthenticated}
	<Sidebar.Provider>
		<AppSidebar />
		<Sidebar.Inset>
			<!-- Top header with trigger -->
			<header class="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
				<SidebarTrigger class="-ml-1" />
				<div class="h-4 w-px bg-border" aria-hidden="true"></div>
				<span class="text-sm font-medium text-muted-foreground">Free AP Practice</span>
			</header>
			<!-- Page content -->
			{@render children()}
		</Sidebar.Inset>
	</Sidebar.Provider>
{:else}
	<div class="flex min-h-screen items-center justify-center bg-background">
		<div
			class="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
		></div>
	</div>
{/if}
