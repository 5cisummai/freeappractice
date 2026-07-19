<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { requestVerificationEmail } from '$lib/auth/request-verification-email.js';
	import AuthSeoHead from '$lib/components/auth/auth-seo-head.svelte';

	const email = $derived(page.url.searchParams.get('email'));

	let errorMessage = $state('');
	let successMessage = $state('');
	let resending = $state(false);

	async function handleResend() {
		if (!email || resending) return;
		errorMessage = '';
		successMessage = '';
		resending = true;
		try {
			// Native Better Auth client API: awaits the send and surfaces provider failures.
			const sendError = await requestVerificationEmail(email);
			if (sendError) {
				errorMessage = sendError;
				return;
			}
			successMessage = 'Verification email sent. Check your inbox.';
		} finally {
			resending = false;
		}
	}
</script>

<AuthSeoHead
	title="Email Sent – Free AP Practice"
	description="Check your inbox for the next step in Free AP Practice account setup."
	path="/email-sent"
/>

<Card.Root>
	<Card.Header class="text-center">
		<Card.Title class="text-xl">Check your email</Card.Title>
		<Card.Description>
			We sent a verification link to
			{#if email}
				<span class="ph-mask-pii font-medium text-foreground">{email}</span>.
			{:else}
				your email address.
			{/if}
			It expires in 15 minutes. Check spam if you don't see it.
		</Card.Description>
	</Card.Header>
	<Card.Content class="flex flex-col gap-4">
		{#if errorMessage}
			<p class="text-center text-sm text-destructive" role="alert">{errorMessage}</p>
		{/if}
		{#if successMessage}
			<p class="text-center text-sm text-muted-foreground" role="status">{successMessage}</p>
		{/if}
		{#if email}
			<Button type="button" variant="outline" onclick={handleResend} disabled={resending}>
				{resending ? 'Sending...' : errorMessage ? 'Try sending again' : "Didn't get it? Resend"}
			</Button>
		{/if}
		<div class="text-center">
			<a href={resolve('/login')} class="text-sm underline underline-offset-4">Back to sign in</a>
		</div>
	</Card.Content>
</Card.Root>
