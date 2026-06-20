<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import {
		FieldGroup,
		Field,
		FieldLabel,
		FieldDescription,
		FieldSeparator
	} from '$lib/components/ui/field/index.js';
	import { resolve } from '$app/paths';
	import { Input } from '$lib/components/ui/input/index.js';
	import { cn } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth-client.js';
	import { authCallbackUrl } from '$lib/auth-callback-url.js';
	import GoogleLogo from '$lib/components/google-logo.svelte';

	let { class: className, ...restProps }: HTMLAttributes<HTMLDivElement> = $props();

	const id = $props.id();

	let email = $state('');
	let password = $state('');
	let errorMessage = $state('');
	let loading = $state(false);
	let googleLoading = $state(false);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		errorMessage = '';
		loading = true;
		try {
			const { error } = await authClient.signIn.email({
				email,
				password,
				callbackURL: authCallbackUrl('/app')
			});
			if (error) {
				errorMessage =
					error.status === 403
						? 'Please verify your email before signing in. Check your inbox for a verification link.'
						: (error.message ?? 'Login failed');
				return;
			}
			goto(resolve('/app'));
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
		try {
			const { error } = await authClient.signIn.social({
				provider: 'google',
				callbackURL: authCallbackUrl('/app'),
				errorCallbackURL: authCallbackUrl('/login')
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
			<Card.Title class="text-xl">Welcome back</Card.Title>
			<Card.Description>Sign in to your Free AP Practice account</Card.Description>
		</Card.Header>
		<Card.Content>
			<form onsubmit={handleSubmit}>
				<FieldGroup>
					<Field>
						<Button type="button" variant="outline" onclick={handleGoogleSignIn} disabled={googleLoading}>
							<GoogleLogo />
							{googleLoading ? 'Redirecting...' : 'Continue with Google'}
						</Button>
					</Field>
					<FieldSeparator class="*:data-[slot=field-separator-content]:bg-card">
						Or continue with
					</FieldSeparator>
					{#if errorMessage}
						<p class="text-center text-sm text-destructive">{errorMessage}</p>
					{/if}
					<Field>
						<FieldLabel for="email-{id}">Email</FieldLabel>
						<Input
							id="email-{id}"
							type="email"
							placeholder="m@example.com"
							required
							bind:value={email}
							autocomplete="email"
						/>
					</Field>
					<Field>
						<div class="flex items-center">
							<FieldLabel for="password-{id}">Password</FieldLabel>
							<a
								href={resolve('/forgot-password')}
								class="ms-auto text-sm underline-offset-4 hover:underline"
							>
								Forgot your password?
							</a>
						</div>
						<Input
							id="password-{id}"
							type="password"
							required
							bind:value={password}
							autocomplete="current-password"
						/>
					</Field>
					<Field>
						<Button type="submit" disabled={loading}>
							{loading ? 'Signing in...' : 'Login'}
						</Button>
						<FieldDescription class="text-center">
							Don't have an account? <a
								href={resolve('/signup')}
								class="underline underline-offset-4">Sign up</a
							>
						</FieldDescription>
					</Field>
				</FieldGroup>
			</form>
		</Card.Content>
	</Card.Root>
	<FieldDescription class="px-6 text-center">
		By clicking continue, you agree to our <a
			href={resolve('/terms')}
			class="underline underline-offset-4">Terms of Service</a
		>
		and <a href={resolve('/privacy')} class="underline underline-offset-4">Privacy Policy</a>.
	</FieldDescription>
</div>
