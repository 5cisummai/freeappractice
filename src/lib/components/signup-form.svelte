<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import type { HTMLAttributes } from 'svelte/elements';
	import { auth } from '$lib/client/auth.svelte.js';
	import { goto } from '$app/navigation';

	let { class: className, ...restProps }: HTMLAttributes<HTMLDivElement> = $props();

	let name = $state('');
	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let errorMessage = $state('');
	let loading = $state(false);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		errorMessage = '';

		if (password !== confirmPassword) {
			errorMessage = 'Passwords do not match';
			return;
		}
		if (password.length < 6) {
			errorMessage = 'Password must be at least 6 characters';
			return;
		}

		loading = true;
		try {
			const res = await fetch('/api/auth/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, email, password })
			});
			const data = await res.json();
			if (!res.ok) {
				errorMessage = data.error ?? 'Registration failed';
				return;
			}
			auth.setAuth(data.token, data.user);
			goto('/email-sent');
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
			<Card.Title class="text-xl">Create your account</Card.Title>
			<Card.Description>Start practicing AP questions for free</Card.Description>
		</Card.Header>
		<Card.Content>
			<form onsubmit={handleSubmit}>
				<Field.Group>
					{#if errorMessage}
						<p class="text-center text-sm text-destructive">{errorMessage}</p>
					{/if}
					<Field.Field>
						<Field.Label for="name">Full Name</Field.Label>
						<Input id="name" type="text" placeholder="John Doe" required bind:value={name} />
					</Field.Field>
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
						<div class="grid grid-cols-2 gap-4">
							<Field.Field>
								<Field.Label for="password">Password</Field.Label>
								<Input id="password" type="password" required bind:value={password} />
							</Field.Field>
							<Field.Field>
								<Field.Label for="confirm-password">Confirm Password</Field.Label>
								<Input
									id="confirm-password"
									type="password"
									required
									bind:value={confirmPassword}
								/>
							</Field.Field>
						</div>
						<Field.Description>Must be at least 6 characters long.</Field.Description>
					</Field.Field>
					<Field.Field>
						<Button type="submit" disabled={loading}>
							{loading ? 'Creating account...' : 'Create Account'}
						</Button>
						<Field.Description class="text-center">
							Already have an account? <a href="/login" class="underline underline-offset-4"
								>Sign in</a
							>
						</Field.Description>
					</Field.Field>
				</Field.Group>
			</form>
		</Card.Content>
	</Card.Root>
	<Field.Description class="px-6 text-center">
		By clicking continue, you agree to our <a href="/terms" class="underline underline-offset-4"
			>Terms of Service</a
		>
		and <a href="/privacy" class="underline underline-offset-4">Privacy Policy</a>.
	</Field.Description>
</div>
