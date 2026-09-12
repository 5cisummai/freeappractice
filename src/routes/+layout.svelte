<script lang="ts">
	import './layout.css';
	import GoogleOneTapPrompt from '$lib/components/auth/google-one-tap-prompt.svelte';
	import AnalyticsConsentBanner from '$lib/components/layout/analytics-consent-banner.svelte';
	import { privacy } from '$lib/client/privacy.svelte.js';
	import { afterNavigate, beforeNavigate, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { invalidateAppSubtree } from '$lib/client/invalidate-data.js';
	import { DEFAULT_THEME } from '$lib/client/theme.svelte.js';
	import { ModeWatcher } from 'mode-watcher';
	import { mountVercelToolbar } from '@vercel/toolbar/vite';
	import { onMount } from 'svelte';
	import {
		parseTimezone,
		TIMEZONE_COOKIE_MAX_AGE,
		TIMEZONE_COOKIE_NAME
	} from '$lib/users/timezone';

	import { capturePostHogPageleave, capturePostHogPageview } from '$lib/client/posthog-analytics';
	import { ACCOUNT_DELETED_QUERY } from '$lib/auth/urls.js';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
	import { toast } from 'svelte-sonner';

	let { children } = $props();

	beforeNavigate(({ from }) => {
		if (from?.url.href) capturePostHogPageleave(from.url.href);
	});

	afterNavigate(({ to }) => {
		capturePostHogPageview(to?.url.href);
	});

	function notifyAccountDeletedIfNeeded() {
		if (page.url.searchParams.get(ACCOUNT_DELETED_QUERY) !== '1') return;
		toast.success('Account deleted successfully');
		const url = new URL(page.url);
		url.searchParams.delete(ACCOUNT_DELETED_QUERY);
		// Pathname is the current resolved route; only the query string changes.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		replaceState(`${url.pathname}${url.search}${url.hash}`, page.state);
	}

	onMount(() => {
		notifyAccountDeletedIfNeeded();
		privacy.init();

		const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		const existing = parseTimezone(
			document.cookie
				.split('; ')
				.find((part) => part.startsWith(`${TIMEZONE_COOKIE_NAME}=`))
				?.slice(TIMEZONE_COOKIE_NAME.length + 1)
		);
		if (timeZone && existing !== timeZone) {
			const secure = window.location.protocol === 'https:' ? '; Secure' : '';
			document.cookie = `${TIMEZONE_COOKIE_NAME}=${encodeURIComponent(timeZone)}; path=/; max-age=${TIMEZONE_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
			if (window.location.pathname.startsWith('/app')) {
				void invalidateAppSubtree();
			}
		}

		if (import.meta.env.DEV) mountVercelToolbar();
	});
</script>

<svelte:head>
	<link rel="icon" href="/logo.png" />
</svelte:head>
<a
	href="#main-content"
	class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-100 focus:rounded-md focus:border focus:border-border focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-lg focus:ring-2 focus:ring-ring focus:outline-none"
>
	Skip to main content
</a>
<ModeWatcher defaultMode={DEFAULT_THEME} />
<Toaster />
<GoogleOneTapPrompt />
<AnalyticsConsentBanner />
{@render children()}
