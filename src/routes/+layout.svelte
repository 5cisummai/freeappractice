<script lang="ts">
	import './layout.css';
	import 'katex/dist/katex.min.css';
	/* hljs light theme (default); dark overrides are in layout.css under .dark */
	import 'highlight.js/styles/github.min.css';
	import logo from '$lib/assets/logo.png';
	import GoogleOneTapPrompt from '$lib/components/auth/google-one-tap-prompt.svelte';
	import { privacy } from '$lib/client/privacy.svelte.js';
	import { afterNavigate } from '$app/navigation';
	import { invalidateAppSubtree } from '$lib/client/invalidate-data.js';
	import { resolve } from '$app/paths';
	import { ModeWatcher } from 'mode-watcher';
	import { mountVercelToolbar } from '@vercel/toolbar/vite';
	import { onMount } from 'svelte';
	import {
		parseTimezone,
		TIMEZONE_COOKIE_MAX_AGE,
		TIMEZONE_COOKIE_NAME
	} from '$lib/users/timezone';

	import { registerWebMcpTools } from '$lib/client/webmcp.js';
	import { capturePostHogPageview } from '$lib/client/posthog-analytics';

	let { children } = $props();

	afterNavigate(({ to }) => {
		capturePostHogPageview(to?.url.href);
	});

	onMount(() => {
		privacy.init();
		registerWebMcpTools();

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
	<link rel="icon" href={logo} />
</svelte:head>
<a
	href="#main-content"
	class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-100 focus:rounded-md focus:border focus:border-border focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-lg focus:ring-2 focus:ring-ring focus:outline-none"
>
	Skip to main content
</a>
<ModeWatcher />
<GoogleOneTapPrompt />
{@render children()}

{#if privacy.initialized && privacy.analyticsConsent === null}
	<div
		class="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur sm:inset-x-4 sm:bottom-4 sm:rounded-xl sm:border"
	>
		<div
			class="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
		>
			<p class="text-sm text-muted-foreground">
				Optional analytics help improve the product. Change anytime in Settings.
				<a href={resolve('/privacy')} class="underline underline-offset-4">Privacy Policy</a>.
			</p>
			<div class="flex shrink-0 gap-2">
				<button
					type="button"
					class="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
					onclick={() => privacy.setAnalyticsConsent('denied')}
				>
					Reject
				</button>
				<button
					type="button"
					class="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
					onclick={() => privacy.setAnalyticsConsent('granted')}
				>
					Accept
				</button>
			</div>
		</div>
	</div>
{/if}
