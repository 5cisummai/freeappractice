<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import { authClient } from '$lib/auth/client.js';
	import { authCallbackUrl } from '$lib/auth/urls.js';
	import AuthSeoHead from '$lib/components/auth/auth-seo-head.svelte';

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
			const { error } = await authClient.verifyEmail({
				query: {
					token,
					callbackURL: authCallbackUrl('/app')
				}
			});
			if (error) {
				status = 'error';
				errorMessage = error.message ?? 'Verification failed';
				return;
			}
			status = 'success';
			setTimeout(() => goto(resolve('/app')), 2000);
		} catch {
			status = 'error';
			errorMessage = 'Network error. Please try again.';
		}
	});
</script>

<AuthSeoHead
	title="Verify Email – Free AP Practice"
	description="Verify your Free AP Practice account email address."
	path="/verify-email"
/>

<div class="text-center">
	{#if status === 'loading'}
		<div class="space-y-4">
			<Spinner class="mx-auto" />
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
				<a href={resolve('/signup')} class="text-sm underline underline-offset-4"
					>Create new account</a
				>
			</div>
		</div>
	{/if}
</div>
