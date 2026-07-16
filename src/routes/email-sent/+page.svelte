<script lang="ts">
	import { onDestroy } from 'svelte';
	import { page } from '$app/state';
	import logo from '$lib/assets/logo.png';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { requestVerificationEmail } from '$lib/auth/request-verification-email.js';

	const email = $derived(page.url.searchParams.get('email'));

	const RESEND_COOLDOWN_SECONDS = 30;

	let errorMessage = $state('');
	let successMessage = $state('');
	let resending = $state(false);
	let cooldownRemaining = $state(0);
	let cooldownInterval: ReturnType<typeof setInterval> | undefined;

	function clearCooldown() {
		if (cooldownInterval) {
			clearInterval(cooldownInterval);
			cooldownInterval = undefined;
		}
		cooldownRemaining = 0;
	}

	function startCooldown() {
		clearCooldown();
		cooldownRemaining = RESEND_COOLDOWN_SECONDS;
		cooldownInterval = setInterval(() => {
			cooldownRemaining -= 1;
			if (cooldownRemaining <= 0) {
				clearCooldown();
			}
		}, 1000);
	}

	onDestroy(clearCooldown);

	async function handleResend() {
		if (!email || resending || cooldownRemaining > 0) return;
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
			startCooldown();
		} finally {
			resending = false;
		}
	}
</script>

<svelte:head>
	<title>Email Sent – Free AP Practice</title>
	<meta
		name="description"
		content="Check your inbox for the next step in Free AP Practice account setup."
	/>
	<meta name="robots" content="noindex, nofollow" />
	<link rel="canonical" href="https://freeappractice.org/email-sent" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://freeappractice.org/email-sent" />
	<meta property="og:title" content="Email Sent – Free AP Practice" />
	<meta
		property="og:description"
		content="Check your inbox for the next step in Free AP Practice account setup."
	/>
	<meta property="og:image" content="https://freeappractice.org/icon.png" />
	<meta property="og:site_name" content="FreeAPPractice.org" />
	<meta property="og:locale" content="en_US" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:url" content="https://freeappractice.org/email-sent" />
	<meta name="twitter:title" content="Email Sent – Free AP Practice" />
	<meta
		name="twitter:description"
		content="Check your inbox for the next step in Free AP Practice account setup."
	/>
	<meta name="twitter:image" content="https://freeappractice.org/icon.png" />
</svelte:head>

<main
	id="main-content"
	class="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10"
>
	<div class="flex w-full max-w-sm flex-col gap-6">
		<a href={resolve('/')} class="flex items-center gap-2 self-center font-medium">
			<img src={logo} alt="Free AP Practice" class="size-6 rounded-sm" />
			Free AP Practice
		</a>

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
					<Button
						type="button"
						variant="outline"
						onclick={handleResend}
						disabled={resending || cooldownRemaining > 0}
					>
						{resending
							? 'Sending...'
							: cooldownRemaining > 0
								? `Resend in ${cooldownRemaining}s`
								: errorMessage
									? 'Try sending again'
									: "Didn't get it? Resend"}
					</Button>
				{/if}
				<div class="text-center">
					<a href={resolve('/login')} class="text-sm underline underline-offset-4">Back to sign in</a>
				</div>
			</Card.Content>
		</Card.Root>
	</div>
</main>
