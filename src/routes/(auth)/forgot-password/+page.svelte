<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { resolve } from '$app/paths';
	import { authClient } from '$lib/auth/client.js';
	import { EMAIL_SEND_FAILED_MESSAGE } from '$lib/auth/resend-result';
	import { authCallbackUrl } from '$lib/auth/urls.js';
	import AuthSeoHead from '$lib/components/auth/auth-seo-head.svelte';

	let email = $state('');
	let loading = $state(false);
	let success = $state(false);
	let errorMessage = $state('');

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		errorMessage = '';
		loading = true;
		try {
			const { error } = await authClient.requestPasswordReset({
				email,
				redirectTo: authCallbackUrl('/reset-password')
			});
			if (error) {
				errorMessage = error.message ?? EMAIL_SEND_FAILED_MESSAGE;
				return;
			}
			// Always show success to prevent email enumeration (including when user does not exist)
			success = true;
		} catch {
			errorMessage = 'Network error. Please try again.';
		} finally {
			loading = false;
		}
	}
</script>

<AuthSeoHead
	title="Forgot Password – Free AP Practice"
	description="Request a password reset for your Free AP Practice account."
	path="/forgot-password"
/>

<Card.Root>
	<Card.Header class="text-center">
		<Card.Title class="text-xl">Reset your password</Card.Title>
		<Card.Description>Enter your email and we'll send a reset link</Card.Description>
	</Card.Header>
	<Card.Content>
		{#if success}
			<div class="space-y-4 text-center">
				<p class="text-sm text-muted-foreground">
					If that email is registered, you'll receive a reset link within a few minutes. Check your
					spam folder if it doesn't arrive.
				</p>
				<a href={resolve('/login')} class="text-sm underline underline-offset-4">Back to sign in</a>
			</div>
		{:else}
			<form onsubmit={handleSubmit}>
				<Field.Group>
					{#if errorMessage}
						<p class="text-center text-sm text-destructive" role="alert">{errorMessage}</p>
					{/if}
					<Field.Field>
						<Field.Label for="email">Email</Field.Label>
						<Input
							id="email"
							type="email"
							placeholder="m@example.com"
							required
							bind:value={email}
						/>
					</Field.Field>
					<Field.Field>
						<Button type="submit" disabled={loading}>
							{loading ? 'Sending...' : 'Send reset link'}
						</Button>
						<Field.Description class="text-center">
							<a href={resolve('/login')} class="underline underline-offset-4">Back to sign in</a>
						</Field.Description>
					</Field.Field>
				</Field.Group>
			</form>
		{/if}
	</Card.Content>
</Card.Root>
