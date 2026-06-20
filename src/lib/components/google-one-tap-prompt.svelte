<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { cancelGoogleOneTap, maybePromptGoogleOneTap } from '$lib/google-one-tap.js';
	import { onDestroy } from 'svelte';

	const PROMPT_DELAY_MS = 400;

	onDestroy(() => {
		cancelGoogleOneTap();
	});

	$effect(() => {
		if (!browser) return;

		const pathname = page.url.pathname;
		const timer = setTimeout(() => {
			void maybePromptGoogleOneTap(pathname);
		}, PROMPT_DELAY_MS);

		return () => {
			clearTimeout(timer);
		};
	});
</script>
