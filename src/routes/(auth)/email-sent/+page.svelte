<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { requestVerificationEmail } from '$lib/auth/request-verification-email.js';
	import { safeAppPath } from '$lib/auth/urls.js';
	import {
		getEmailDeliveryFailureMessage,
		getEmailDeliverySuccessMessage,
		type EmailDeliveryStatus,
		type EmailDeliveryType
	} from '$lib/auth/email-delivery';
	import AuthSeoHead from '$lib/components/auth/auth-seo-head.svelte';

	const email = $derived(page.url.searchParams.get('email'));
	const redirectPath = $derived(safeAppPath(page.url.searchParams.get('redirect')));
	let activeDeliveryId = $state(page.url.searchParams.get('delivery') ?? '');
	let deliveryStatus = $state<EmailDeliveryStatus>(
		page.url.searchParams.get('send') === 'failed' ? 'failed' : 'pending'
	);
	let deliveryType = $state<EmailDeliveryType>('verification');
	let errorMessage = $state(
		page.url.searchParams.get('send') === 'failed'
			? getEmailDeliveryFailureMessage('verification')
			: ''
	);
	let resending = $state(false);
	let timedOut = $state(false);
	let stopPolling = () => {};
	const displayedError = $derived(errorMessage);

	function isEmailDeliveryStatus(value: unknown): value is EmailDeliveryStatus {
		return value === 'pending' || value === 'sent' || value === 'failed';
	}

	function isEmailDeliveryType(value: unknown): value is EmailDeliveryType {
		return (
			value === 'verification' ||
			value === 'password_reset' ||
			value === 'email_change' ||
			value === 'account_deletion' ||
			value === 'existing_signup' ||
			value === 'organization_invitation'
		);
	}

	function startPolling(deliveryId: string) {
		stopPolling();
		if (!deliveryId || deliveryStatus !== 'pending') return;
		let cancelled = false;
		let attempts = 0;
		let timer: ReturnType<typeof setTimeout> | undefined;

		async function pollDeliveryStatus() {
			if (cancelled) return;

			try {
				const response = await fetch(`/api/email-delivery/${encodeURIComponent(deliveryId)}`, {
					cache: 'no-store',
					headers: { accept: 'application/json' }
				});
				if (response.ok) {
					const result: { status?: unknown; emailType?: unknown } = await response.json();
					if (!cancelled && deliveryId === activeDeliveryId) {
						if (isEmailDeliveryType(result.emailType)) deliveryType = result.emailType;
						if (isEmailDeliveryStatus(result.status)) {
							deliveryStatus = result.status;
							if (result.status === 'sent') errorMessage = '';
							if (result.status === 'failed') {
								errorMessage = getEmailDeliveryFailureMessage(deliveryType);
							}
							if (result.status !== 'pending') return;
						}
					}
				}
			} catch {
				// Keep polling through transient browser or function errors.
			}
			if (cancelled || deliveryId !== activeDeliveryId) return;

			attempts += 1;
			if (attempts >= 60) {
				if (!cancelled && deliveryId === activeDeliveryId) timedOut = true;
				return;
			}
			timer = setTimeout(pollDeliveryStatus, 1000);
		}

		stopPolling = () => {
			cancelled = true;
			if (timer) clearTimeout(timer);
		};
		void pollDeliveryStatus();
	}

	onMount(() => {
		startPolling(activeDeliveryId);
		return () => stopPolling();
	});

	async function handleResend() {
		if (!email || resending) return;
		stopPolling();
		errorMessage = '';
		deliveryStatus = 'pending';
		timedOut = false;
		resending = true;
		try {
			const result = await requestVerificationEmail(email, redirectPath);
			activeDeliveryId = result.deliveryId;
			if (result.error) {
				deliveryStatus = 'failed';
				errorMessage = result.error;
			} else {
				deliveryStatus = 'pending';
				startPolling(activeDeliveryId);
			}
		} finally {
			resending = false;
		}
	}
</script>

<AuthSeoHead
	title="Email Sent | Free AP Practice"
	description="Check your inbox for the next step in Free AP Practice account setup."
	path="/email-sent"
/>

<Card.Root>
	<Card.Header class="text-center">
		<Card.Title class="text-xl">Check your email</Card.Title>
		<Card.Description>
			{#if deliveryStatus === 'failed'}
				Your account was created, but the verification email could not be sent.
			{:else if deliveryStatus === 'pending' && activeDeliveryId}
				We're sending a verification link to
				{#if email}
					<span class="ph-mask-pii font-medium text-foreground">{email}</span>.
				{:else}
					your email address.
				{/if}
			{:else}
				We sent a verification link to
				{#if email}
					<span class="ph-mask-pii font-medium text-foreground">{email}</span>.
				{:else}
					your email address.
				{/if}
				It expires in 15 minutes. Check spam if you don't see it.
			{/if}
		</Card.Description>
	</Card.Header>
	<Card.Content class="flex flex-col gap-4">
		{#if deliveryStatus === 'pending' && activeDeliveryId}
			<div
				class="flex items-center justify-center gap-2 text-center text-sm text-muted-foreground"
				role="status"
			>
				<span
					class="size-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary"
					aria-hidden="true"
				></span>
				<span
					>{timedOut
						? 'Still waiting for the email provider...'
						: 'Sending verification email...'}</span
				>
			</div>
		{:else if displayedError}
			<p class="text-center text-sm text-destructive" role="alert">{displayedError}</p>
		{:else if deliveryStatus === 'sent'}
			<p class="text-center text-sm text-muted-foreground" role="status">
				{getEmailDeliverySuccessMessage(deliveryType)}
			</p>
		{/if}
		{#if email}
			<Button
				type="button"
				variant="outline"
				onclick={handleResend}
				disabled={resending || (deliveryStatus === 'pending' && !timedOut)}
			>
				{resending || (deliveryStatus === 'pending' && !timedOut)
					? 'Sending...'
					: displayedError || timedOut
						? 'Try sending again'
						: "Didn't get it? Resend"}
			</Button>
		{/if}
		<div class="text-center">
			<a
				href={resolve(`/login?redirect=${encodeURIComponent(redirectPath)}`)}
				class="text-sm underline underline-offset-4">Back to sign in</a
			>
		</div>
	</Card.Content>
</Card.Root>
