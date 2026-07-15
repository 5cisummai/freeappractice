<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import type { HTMLAttributes } from 'svelte/elements';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { authClient } from '$lib/auth/client.js';
	import { authCallbackUrl } from '$lib/auth/urls.js';
	import GoogleLogo from '$lib/components/auth/google-logo.svelte';
	import { captureSignupCompleted, captureSignupStarted } from '$lib/client/activation-analytics';
	import { capturePostHogEvent, identifyPostHogUser } from '$lib/client/posthog-analytics';

	let { class: className, ...restProps }: HTMLAttributes<HTMLDivElement> = $props();

	let name = $state('');
	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let errorMessage = $state('');
	let loading = $state(false);
	let googleLoading = $state(false);

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
		captureSignupStarted('email');
		try {
			const { data, error } = await authClient.signUp.email({
				name,
				email,
				password,
				callbackURL: authCallbackUrl('/app')
			});
			if (error) {
				errorMessage = error.message ?? 'Registration failed';
				return;
			}
			const userId = data?.user?.id;
			if (userId) {
				identifyPostHogUser(userId, { name });
			}
			capturePostHogEvent('user_signed_up', { method: 'email' });
			captureSignupCompleted('email');
			const emailSentHref = `${resolve('/email-sent')}?email=${encodeURIComponent(email)}`;
			// The base path is resolved above; only the encoded query string is appended.
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			goto(emailSentHref);
		} catch {
			errorMessage = 'Network error. Please try again.';
		} finally {
			loading = false;
		}
	}

	async function handleGoogleSignIn() {
		if (googleLoading) return;
		errorMessage = '';
		googleLoading = true;
		captureSignupStarted('google');
		try {
			const { error } = await authClient.signIn.social({
				provider: 'google',
				callbackURL: authCallbackUrl('/app'),
				errorCallbackURL: authCallbackUrl('/signup'),
				newUserCallbackURL: `${authCallbackUrl('/app')}?signup=google`
			});
			if (error) errorMessage = error.message ?? 'Google sign-in failed';
		} finally {
			googleLoading = false;
		}
	}
</script>

<div class={cn('flex flex-col gap-6', className)} {...restProps}>
	<Card.Root>
		<Card.Header class="text-center">
			<Card.Title class="text-xl">Create your account</Card.Title>
			<Card.Description>Start practicing AP questions for free</Card.Description>
		</Card.Header>
		<Card.Content>
			<form onsubmit={handleSubmit}>
				<Field.Group>
					<Field.Field>
						<Button
							type="button"
							variant="outline"
							onclick={handleGoogleSignIn}
							disabled={googleLoading}
						>
							<GoogleLogo />
							{googleLoading ? 'Redirecting...' : 'Continue with Google'}
						</Button>
					</Field.Field>
					<Field.Separator class="*:data-[slot=field-separator-content]:bg-card">
						Or continue with email
					</Field.Separator>
					{#if errorMessage}
						<p class="text-center text-sm text-destructive">{errorMessage}</p>
					{/if}
					<Field.Field>
						<Field.Label for="name">Full Name</Field.Label>
						<Input
							id="name"
							type="text"
							placeholder="John Doe"
							required
							bind:value={name}
							autocomplete="name"
						/>
					</Field.Field>
					<Field.Field>
						<Field.Label for="email">Email</Field.Label>
						<Input
							id="email"
							type="email"
							placeholder="m@example.com"
							required
							bind:value={email}
							autocomplete="email"
						/>
					</Field.Field>
					<Field.Field>
						<div class="grid grid-cols-2 gap-4">
							<Field.Field>
								<Field.Label for="password">Password</Field.Label>
								<Input
									id="password"
									type="password"
									required
									bind:value={password}
									autocomplete="new-password"
								/>
							</Field.Field>
							<Field.Field>
								<Field.Label for="confirm-password">Confirm Password</Field.Label>
								<Input
									id="confirm-password"
									type="password"
									required
									bind:value={confirmPassword}
									autocomplete="new-password"
								/>
							</Field.Field>
						</div>
						<Field.Description>Must be at least 8 characters long.</Field.Description>
					</Field.Field>
					<Field.Field>
						<Button type="submit" disabled={loading}>
							{loading ? 'Creating account...' : 'Create Account'}
						</Button>
						<Field.Description class="text-center">
							Already have an account? <a
								href={resolve('/login')}
								class="underline underline-offset-4">Sign in</a
							>
						</Field.Description>
					</Field.Field>
				</Field.Group>
			</form>
		</Card.Content>
	</Card.Root>
	<Field.Description class="px-6 text-center">
		By clicking continue, you agree to our <a
			href={resolve('/terms')}
			class="underline underline-offset-4">Terms of Service</a
		>
		and <a href={resolve('/privacy')} class="underline underline-offset-4">Privacy Policy</a>.
	</Field.Description>
</div>
