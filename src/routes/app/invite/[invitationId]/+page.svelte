<script lang="ts">
	import { goto } from '$app/navigation';
	import { invalidateAppLayout } from '$lib/client/invalidate-data.js';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { authClient } from '$lib/auth/client.js';
	import { isShareToken } from '$lib/auth/organization-types';
	import { apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/api.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import { onMount } from 'svelte';

	let status = $state<'working' | 'success' | 'error'>('working');
	let message = $state('Joining organization…');

	async function acceptInvite() {
		const invitationId = page.params.invitationId;
		if (!invitationId) {
			status = 'error';
			message = 'That invite link is missing.';
			return;
		}

		try {
			if (isShareToken(invitationId)) {
				const response = await apiFetch('/api/orgs/join', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ token: invitationId })
				});
				const payload = await readJsonOrNull<{ error?: string }>(response);
				if (!response.ok) {
					throw new Error(getResponseMessage(payload, 'Could not join that organization.'));
				}
			} else {
				const { error } = await authClient.organization.acceptInvitation({ invitationId });
				if (error) {
					throw new Error(error.message ?? 'Could not accept that invitation.');
				}
			}
			status = 'success';
			message = 'You joined the organization.';
			await invalidateAppLayout();
			await goto(resolve('/app'));
		} catch (error) {
			status = 'error';
			message = error instanceof Error ? error.message : 'Could not accept that invitation.';
		}
	}

	onMount(() => {
		void acceptInvite();
	});
</script>

<svelte:head>
	<title>Join organization | Free AP Practice</title>
</svelte:head>

<div class="mx-auto max-w-md px-4 py-10">
	<Card.Root>
		<Card.Header>
			<Card.Title>Organization invite</Card.Title>
			<Card.Description>{message}</Card.Description>
		</Card.Header>
		<Card.Content class="flex flex-col items-start gap-3">
			{#if status === 'working'}
				<Spinner />
			{:else if status === 'error'}
				<Button href={resolve('/app')} variant="outline">Back to app</Button>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
