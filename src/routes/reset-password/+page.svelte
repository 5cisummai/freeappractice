<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { auth } from '$lib/client/auth.svelte.js';
	import { goto } from '$app/navigation';
	import logo from '$lib/assets/logo.png';
	import { resolve } from '$app/paths';

	const token = $derived(page.url.searchParams.get('token') ?? '');

	let password = $state('');
	let confirmPassword = $state('');
	let loading = $state(false);
	let errorMessage = $state('');
	let success = $state(false);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		errorMessage = '';

		if (password !== confirmPassword) {
			errorMessage = 'Passwords do not match';
			return;
		}
		if (password.length < 8) {
			errorMessage = 'Password must be at least 8 characters';
			return;
		}

		loading = true;
		try {
			const res = await fetch('/api/auth/reset-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token, password })
			});
			const data = await res.json();
			if (!res.ok) {
				errorMessage = data.error ?? 'Reset failed';
				return;
			}
			auth.setAuth(data.token, data.user);
			goto(resolve('/app'));
		} catch {
			errorMessage = 'Network error. Please try again.';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Reset Password – Free AP Practice</title>
	<meta name="description" content="Reset your Free AP Practice account password." />
	<meta name="robots" content="noindex, nofollow" />
	<link rel="canonical" href="https://freeappractice.org/reset-password" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://freeappractice.org/reset-password" />
	<meta property="og:title" content="Reset Password – Free AP Practice" />
	<meta property="og:description" content="Reset your Free AP Practice account password." />
	<meta property="og:image" content="https://freeappractice.org/assets/icon.png" />
	<meta property="og:site_name" content="FreeAPPractice.org" />
	<meta property="og:locale" content="en_US" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:url" content="https://freeappractice.org/reset-password" />
	<meta name="twitter:title" content="Reset Password – Free AP Practice" />
	<meta name="twitter:description" content="Reset your Free AP Practice account password." />
	<meta name="twitter:image" content="https://freeappractice.org/assets/icon.png" />
</svelte:head>

<div class="flex min-h-svh flex-col items-center justify-center gap-6 bg p-6 md:p-10">
	<div class="flex w-full max-w-sm flex-col gap-6">
		<a href={resolve('/')} class="flex items-center gap-2 self-center font-medium">
			<img src={logo} alt="Free AP Practice" class="size-6 rounded-sm" />
			Free AP Practice
		</a>

		<Card.Root>
			<Card.Header class="text-center">
				<Card.Title class="text-xl">Set new password</Card.Title>
				<Card.Description>Choose a strong password for your account</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if !token}
					<div class="space-y-4 text-center">
						<p class="text-sm text-destructive">Invalid or missing reset token.</p>
						<a href={resolve('/forgot-password')} class="text-sm underline underline-offset-4"
							>Request a new link</a
						>
					</div>
				{:else}
					<form onsubmit={handleSubmit}>
						<Field.Group>
							{#if errorMessage}
								<p class="text-center text-sm text-destructive">{errorMessage}</p>
							{/if}
							<Field.Field>
								<Field.Label for="password">New Password</Field.Label>
								<Input id="password" type="password" required bind:value={password} />
							</Field.Field>
							<Field.Field>
								<Field.Label for="confirm">Confirm Password</Field.Label>
								<Input id="confirm" type="password" required bind:value={confirmPassword} />
								<Field.Description>Must be at least 8 characters.</Field.Description>
							</Field.Field>
							<Field.Field>
								<Button type="submit" disabled={loading}>
									{loading ? 'Saving...' : 'Set new password'}
								</Button>
							</Field.Field>
						</Field.Group>
					</form>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>
</div>
