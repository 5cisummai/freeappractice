<script lang="ts">
	import { onMount } from 'svelte';
	import { afterNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import AppSidebar from '$lib/components/layout/app-sidebar.svelte';
	import CoachShell from '$lib/components/super/coach-shell.svelte';
	import CoachSidebarProvider from '$lib/components/super/coach-sidebar-provider.svelte';
	import CoachSidebarRoot from '$lib/components/super/coach-sidebar.svelte';
	import CoachSidebarTrigger from '$lib/components/super/coach-sidebar-trigger.svelte';
	import FreeBetaClaimDialog from '$lib/components/super/free-beta-claim-dialog.svelte';
	import ThemeToggle from '$lib/components/layout/theme-toggle.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { SidebarTrigger } from '$lib/components/ui/sidebar/index.js';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
	import { setCoachPageToolbar } from '$lib/components/super/coach-context.svelte.js';
	import {
		captureAuthenticatedStudentReturnedIfNeeded,
		captureSignupCompleted
	} from '$lib/client/activation-analytics';
	import { identifyPostHogUser } from '$lib/client/posthog-analytics';
	import { apiFetch } from '$lib/client/api.js';
	import {
		recordPendingSharedQuizRunFailure,
		readPendingSharedQuizRuns,
		removePendingSharedQuizRun
	} from '$lib/shared-practice/pending-runs.js';

	let { data, children } = $props();
	const coachPageToolbar = setCoachPageToolbar();
	const isOnboarding = $derived(page.url.pathname.endsWith('/app/onboarding'));
	const isCoachPage = $derived.by(() => {
		const coachHref = resolve('/app/coach');
		return page.url.pathname === coachHref || page.url.pathname.startsWith(`${coachHref}/`);
	});
	const showCoachSidebar = $derived(data.coachSidebarEnabled && !isCoachPage);
	let freeBetaClaimOpen = $state(false);
	let layoutMounted = $state(false);

	$effect(() => {
		if (data.showFreeBetaClaimDialog && !isOnboarding) {
			freeBetaClaimOpen = true;
		} else if (!data.showFreeBetaClaimDialog) {
			freeBetaClaimOpen = false;
		}
	});

	onMount(() => {
		layoutMounted = true;
		if (data.user) {
			identifyPostHogUser(data.user.id);
			captureAuthenticatedStudentReturnedIfNeeded();
			const pendingRuns = readPendingSharedQuizRuns();
			for (const pendingRun of pendingRuns) {
				void apiFetch('/api/me/quiz-attempts', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(pendingRun)
				})
					.then((response) => {
						if (response.ok || [400, 404, 422].includes(response.status)) {
							removePendingSharedQuizRun(pendingRun.quizId);
						} else recordPendingSharedQuizRunFailure(pendingRun.quizId);
					})
					.catch(() => recordPendingSharedQuizRunFailure(pendingRun.quizId));
			}
		}
	});

	afterNavigate(() => {
		if (!data.user || page.url.searchParams.get('signup') !== 'google') return;

		captureSignupCompleted('google');
		const url = new URL(page.url);
		url.searchParams.delete('signup');
		const appHref = `${resolve('/app')}${url.search}`;
		// appHref is resolved above; the query string is appended after resolution.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(appHref, { replaceState: true, keepFocus: true, noScroll: true });
	});
</script>

<svelte:head>
	<meta name="robots" content="noindex, nofollow" />
	<meta name="googlebot" content="noindex, nofollow" />
	<link rel="canonical" href="https://freeappractice.org/app" />
</svelte:head>

<Toaster />
{#if !isOnboarding}
	<FreeBetaClaimDialog bind:open={freeBetaClaimOpen} />
{/if}

{#if isOnboarding}
	<main id="main-content" class="min-h-svh bg-background">
		{@render children()}
	</main>
{:else}
	<CoachSidebarProvider>
		<Sidebar.Provider class="bg-sidebar">
			<AppSidebar
				isAdmin={data.isAdmin}
				user={data.user}
				assistantFeaturesEnabled={data.assistantFeaturesEnabled}
				organizations={data.organizations}
				activeOrganization={data.activeOrganization}
				ownedGroupCount={data.ownedGroupCount}
			/>
			<Sidebar.Inset>
				<header class="sticky top-0 z-10 flex shrink-0 items-center gap-2 p-4">
					<SidebarTrigger />
					<div class="ml-auto flex items-center gap-2">
						{#if isCoachPage && coachPageToolbar.snippet}
							{@render coachPageToolbar.snippet()}
						{/if}
						{#if layoutMounted}
							<ThemeToggle />
						{/if}
						{#if showCoachSidebar}
							<CoachSidebarTrigger />
						{/if}
					</div>
				</header>

				<div class="flex-1">
					{@render children()}
				</div>
			</Sidebar.Inset>

			{#if showCoachSidebar}
				<CoachSidebarRoot>
					<Sidebar.Content class="min-h-0 overflow-hidden p-0">
						<CoachShell surface="sidebar" />
					</Sidebar.Content>
				</CoachSidebarRoot>
			{/if}
		</Sidebar.Provider>
	</CoachSidebarProvider>
{/if}
