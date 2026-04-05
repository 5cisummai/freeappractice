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
	import { auth } from '$lib/client/auth.svelte.js';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { PUBLIC_GOOGLE_CLIENT_ID } from '$env/static/public';

	let { class: className, ...restProps }: HTMLAttributes<HTMLDivElement> = $props();

	const id = $props.id();

	let email = $state('');
	let password = $state('');
	let errorMessage = $state('');
	let loading = $state(false);
	let googleButtonDiv = $state<HTMLDivElement | null>(null);

	async function handleGoogleCredential(credential: string) {
		errorMessage = '';
		try {
			const res = await fetch('/api/auth/google', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ idToken: credential })
			});
			const data = await res.json();
			if (!res.ok) {
				errorMessage = data.error ?? 'Google sign-in failed';
				return;
			}
			auth.setAuth(data.token, data.user);
			goto(resolve('/app'));
		} catch {
			errorMessage = 'Network error. Please try again.';
		}
	}

	function initGoogleSignIn() {
		if (!googleButtonDiv || !window.google?.accounts) return;
		window.google.accounts.id.initialize({
			client_id: PUBLIC_GOOGLE_CLIENT_ID,
			callback: (response: { credential: string }) => {
				handleGoogleCredential(response.credential);
			}
		});
		window.google.accounts.id.renderButton(googleButtonDiv, {
			type: 'standard',
			theme: 'outline',
			size: 'large',
			width: String(googleButtonDiv.offsetWidth || 400)
		});
	}

	onMount(() => {
		if (window.google?.accounts) {
			initGoogleSignIn();
		} else {
			const script = document.getElementById('google-gsi') as HTMLScriptElement | null;
			if (script) {
				script.addEventListener('load', initGoogleSignIn);
			}
		}
	});

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		errorMessage = '';
		loading = true;
		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password })
			});
			const data = await res.json();
			if (!res.ok) {
				errorMessage = data.error ?? 'Login failed';
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
						<div bind:this={googleButtonDiv} class="flex w-full justify-center"></div>
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
						<Input id="password-{id}" type="password" required bind:value={password} />
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
