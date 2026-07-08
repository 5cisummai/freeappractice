<script lang="ts">
	import './layout.css';
	import 'katex/dist/katex.min.css';
	/* hljs light theme (default); dark overrides are in layout.css under .dark */
	import 'highlight.js/styles/github.min.css';
	import logo from '$lib/assets/logo.png';
	import SkipToMain from '$lib/components/skip-to-main.svelte';
	import GoogleOneTapPrompt from '$lib/components/google-one-tap-prompt.svelte';
	import { privacy } from '$lib/client/privacy.svelte.js';
	import { resolve } from '$app/paths';
	import { ModeWatcher } from 'mode-watcher';
	import { mountVercelToolbar } from '@vercel/toolbar/vite';
	import { onMount } from 'svelte';

	import { registerWebMcpTools } from '$lib/client/webmcp.js';

	let { children } = $props();

	onMount(() => {
		privacy.init();
		registerWebMcpTools();
		if (import.meta.env.DEV) mountVercelToolbar();
	});
</script>

<svelte:head>
	<link rel="icon" href={logo} />
</svelte:head>
<SkipToMain />
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
						This personal project uses cookieless Vercel Analytics for traffic and performance. You
						can also opt in to PostHog for detailed product usage, error tracking, and session
						replay. You can change this later in Settings. See our
						<a href={resolve('/privacy')} class="underline underline-offset-4">Privacy Policy</a>.
					</p>
				</div>
				<div class="flex flex-wrap gap-2 sm:shrink-0">
					<button
						type="button"
						class="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
						onclick={() => privacy.setAnalyticsConsent('denied')}
					>
						Reject
					</button>
					<button
						type="button"
						class="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
						onclick={() => privacy.setAnalyticsConsent('granted')}
					>
						Accept
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
