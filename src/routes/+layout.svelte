<script lang="ts">
	import './layout.css';
	import 'katex/dist/katex.min.css';
	/* hljs light theme (default); dark overrides are in layout.css under .dark */
	import 'highlight.js/styles/github.min.css';
	import logo from '$lib/assets/logo.png';
	import GoogleOneTapPrompt from '$lib/components/auth/google-one-tap-prompt.svelte';
	import { privacy } from '$lib/client/privacy.svelte.js';
	import { afterNavigate, invalidateAll } from '$app/navigation';
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
			void invalidateAll();
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
	<div class="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
		<div
			class="w-full max-w-2xl rounded-2xl border border-border bg-background/95 p-4 shadow-lg backdrop-blur"
		>
			<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div class="space-y-1">
					<p class="font-semibold text-foreground">Optional product analytics</p>
					<p class="text-sm leading-6 text-muted-foreground">
						Free AP Practice is intended for students age 13 and older. If you are under 13, choose
						Reject optional analytics, then do not create an account or submit personal information.
						This personal project uses cookieless Vercel Analytics for traffic and performance. You
						can also opt in to detailed product analytics, including feature usage and optional
						session replay. You can change this later in Settings. See our
						<a href={resolve('/privacy')} class="underline underline-offset-4">Privacy Policy</a>.
					</p>
				</div>
				<div class="flex flex-wrap gap-2 sm:shrink-0">
					<button
						type="button"
						class="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
						onclick={() => privacy.setAnalyticsConsent('denied')}
					>
						Reject optional analytics
					</button>
					<button
						type="button"
						class="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
						onclick={() => privacy.setAnalyticsConsent('granted')}
					>
						Accept optional analytics
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
