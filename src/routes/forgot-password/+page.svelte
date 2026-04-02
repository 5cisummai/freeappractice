<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import logo from '$lib/assets/logo.png';

	let email = $state('');
	let loading = $state(false);
	let success = $state(false);
	let errorMessage = $state('');

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		errorMessage = '';
		loading = true;
		try {
			const res = await fetch('/api/auth/forgot-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email })
			});
			// Always show success to prevent email enumeration
			success = true;
		} catch {
			errorMessage = 'Network error. Please try again.';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Forgot Password – Free AP Practice</title>
	<meta name="description" content="Request a password reset for your Free AP Practice account." />
	<meta name="robots" content="noindex, nofollow" />
	<link rel="canonical" href="https://freeappractice.org/forgot-password" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://freeappractice.org/forgot-password" />
	<meta property="og:title" content="Forgot Password – Free AP Practice" />
	<meta
		property="og:description"
		content="Request a password reset for your Free AP Practice account."
	/>
	<meta property="og:image" content="https://freeappractice.org/icon.png" />
	<meta property="og:site_name" content="FreeAPPractice.org" />
	<meta property="og:locale" content="en_US" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:url" content="https://freeappractice.org/forgot-password" />
	<meta name="twitter:title" content="Forgot Password – Free AP Practice" />
	<meta
		name="twitter:description"
		content="Request a password reset for your Free AP Practice account."
	/>
	<meta name="twitter:image" content="https://freeappractice.org/icon.png" />
</svelte:head>

<div class="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
	<div class="flex w-full max-w-sm flex-col gap-6">
		<a href="/" class="flex items-center gap-2 self-center font-medium">
			<img src={logo} alt="Free AP Practice" class="size-6 rounded-sm" />
			Free AP Practice
		</a>

		<Card.Root>
			<Card.Header class="text-center">
				<Card.Title class="text-xl">Reset your password</Card.Title>
				<Card.Description>Enter your email and we'll send a reset link</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if success}
					<div class="space-y-4 text-center">
						<p class="text-sm text-muted-foreground">
							If that email is registered, you'll receive a reset link within a few minutes. Check
							your spam folder if it doesn't arrive.
						</p>
						<a href="/login" class="text-sm underline underline-offset-4">Back to sign in</a>
					</div>
				{:else}
					<form onsubmit={handleSubmit}>
						<Field.Group>
							{#if errorMessage}
								<p class="text-center text-sm text-destructive">{errorMessage}</p>
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
									<a href="/login" class="underline underline-offset-4">Back to sign in</a>
								</Field.Description>
							</Field.Field>
						</Field.Group>
					</form>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>
</div>
