<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { auth } from '$lib/client/auth.svelte.js';
	import { goto } from '$app/navigation';
	import logo from '$lib/assets/logo.png';
	import { resolve } from '$app/paths';


	let status = $state<'loading' | 'success' | 'error'>('loading');
	let errorMessage = $state('');

	const token = $derived(page.url.searchParams.get('token') ?? '');

	onMount(async () => {
		if (!token) {
			status = 'error';
			errorMessage = 'No verification token found.';
			return;
		}
		try {
			const res = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
			const data = await res.json();
			if (!res.ok) {
				status = 'error';
				errorMessage = data.error ?? 'Verification failed';
				return;
			}
			auth.setAuth(data.token, data.user);
			status = 'success';
			setTimeout(() => goto(resolve('/app')), 2000);
		} catch {
			status = 'error';
			errorMessage = 'Network error. Please try again.';
		}
	});
</script>

<svelte:head>
	<title>Verify Email – Free AP Practice</title>
	<meta name="description" content="Verify your Free AP Practice account email address." />
	<meta name="robots" content="noindex, nofollow" />
	<link rel="canonical" href="https://freeappractice.org/verify-email" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://freeappractice.org/verify-email" />
	<meta property="og:title" content="Verify Email – Free AP Practice" />
	<meta property="og:description" content="Verify your Free AP Practice account email address." />
	<meta property="og:image" content="https://freeappractice.org/icon.png" />
	<meta property="og:site_name" content="FreeAPPractice.org" />
	<meta property="og:locale" content="en_US" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:url" content="https://freeappractice.org/verify-email" />
	<meta name="twitter:title" content="Verify Email – Free AP Practice" />
	<meta name="twitter:description" content="Verify your Free AP Practice account email address." />
	<meta name="twitter:image" content="https://freeappractice.org/icon.png" />
</svelte:head>

<div class="flex min-h-svh flex-col items-center justify-center gap-6 bg p-6 md:p-10">
	<div class="flex w-full max-w-sm flex-col gap-6 text-center">
		<a href={resolve('/')} class="flex items-center gap-2 self-center font-medium">
			<img src={logo} alt="Free AP Practice" class="size-6 rounded-sm" />
			Free AP Practice
		</a>

		{#if status === 'loading'}
			<div class="space-y-4">
				<div
					class="mx-auto size-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
				></div>
				<p class="text-sm text-muted-foreground">Verifying your email...</p>
			</div>
		{:else if status === 'success'}
			<div class="space-y-4">
				<div
					class="mx-auto flex size-12 items-center justify-center rounded-full bg-green-100 text-2xl text-green-600"
				>
					✓
				</div>
				<h1 class="text-xl font-semibold">Email verified!</h1>
				<p class="text-sm text-muted-foreground">
					Your account is confirmed. Redirecting you to the app...
				</p>
			</div>
		{:else}
			<div class="space-y-4">
				<div
					class="mx-auto flex size-12 items-center justify-center rounded-full bg-red-100 text-2xl text-red-600"
				>
					✗
				</div>
				<h1 class="text-xl font-semibold">Verification failed</h1>
				<p class="text-sm text-destructive">{errorMessage}</p>
				<div class="flex flex-col gap-2">
					<a href={resolve('/login')} class="text-sm underline underline-offset-4">Go to sign in</a>
					<a href={resolve('/signup')} class="text-sm underline underline-offset-4">Create new account</a>
				</div>
			</div>
		{/if}
	</div>
</div>
