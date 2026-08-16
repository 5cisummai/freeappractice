<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { authClient } from '$lib/auth/client.js';
	import {
		orgAvatarClass,
		orgAvatarLetter,
		type OrganizationRole
	} from '$lib/auth/organization-types';
	import { apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/api.js';
	import PageShell from '$lib/components/layout/page-shell.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Field, FieldGroup, FieldLabel } from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import { toast } from 'svelte-sonner';

	let { data } = $props();

	const organization = $derived(data.activeOrganization);
	const canInvite = $derived(
		organization?.orgType === 'group' &&
			(organization.role === 'owner' || organization.role === 'admin')
	);

	let inviteEmail = $state('');
	let busy = $state(false);

	function roleLabel(role: OrganizationRole): string {
		switch (role) {
			case 'owner':
				return 'Owner';
			case 'admin':
				return 'Admin';
			case 'member':
				return 'Member';
			default: {
				const exhaustive: never = role;
				return exhaustive;
			}
		}
	}

	async function copyInviteLink() {
		if (!organization) return;
		try {
			const response = await apiFetch('/api/orgs/invite-link', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ organizationId: organization.id })
			});
			const payload = await readJsonOrNull<{ url?: string; error?: string }>(response);
			if (!response.ok || !payload?.url) {
				throw new Error(getResponseMessage(payload, 'Could not copy invite link.'));
			}
			await navigator.clipboard.writeText(payload.url);
			toast.success('Invite link copied.');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not copy invite link.');
		}
	}

	async function sendInviteEmail() {
		const email = inviteEmail.trim();
		if (!organization || !email || busy) return;
		busy = true;
		try {
			const { error } = await authClient.organization.inviteMember({
				email,
				role: 'member',
				organizationId: organization.id
			});
			if (error) {
				throw new Error(error.message ?? 'Could not send that invite.');
			}
			inviteEmail = '';
			toast.success('Invite sent.');
			await invalidateAll();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not send that invite.');
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>Members | Free AP Practice</title>
</svelte:head>

<PageShell
	title="Members"
	description={organization ? `People in ${organization.name}.` : 'People in this organization.'}
>
	{#if canInvite}
		<section class="rounded-xl border bg-card p-5">
			<h2 class="font-medium">Invite</h2>
			<p class="mt-1 text-sm text-muted-foreground">
				Copy a link anyone with an account can use, or email a specific person.
			</p>
			<div class="mt-4 flex flex-col gap-4">
				<Button type="button" variant="outline" class="w-fit" onclick={copyInviteLink}>
					<CopyIcon />
					Copy invite link
				</Button>
				<FieldGroup>
					<Field>
						<FieldLabel for="members-invite-email">Email</FieldLabel>
						<div class="flex flex-col gap-2 sm:flex-row">
							<Input
								id="members-invite-email"
								type="email"
								bind:value={inviteEmail}
								placeholder="friend@example.com"
							/>
							<Button
								type="button"
								onclick={sendInviteEmail}
								disabled={busy || !inviteEmail.trim()}
							>
								{#if busy}<Spinner data-icon="inline-start" />{/if}
								Send invite
							</Button>
						</div>
					</Field>
				</FieldGroup>
			</div>
		</section>
	{/if}

	<ul class="flex flex-col gap-2">
		{#each data.members as member (member.memberId)}
			<li class="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
				{#if member.image}
					<img src={member.image} alt="" class="size-9 rounded-md object-cover" />
				{:else}
					<span
						class="flex size-9 shrink-0 items-center justify-center rounded-md text-sm font-semibold {orgAvatarClass(
							member.userId
						)}"
					>
						{orgAvatarLetter(member.name)}
					</span>
				{/if}
				<div class="min-w-0 flex-1">
					<p class="ph-mask-pii truncate font-medium">{member.name}</p>
					<p class="ph-mask-pii truncate text-sm text-muted-foreground">{member.email}</p>
				</div>
				<Badge variant="secondary">{roleLabel(member.role)}</Badge>
			</li>
		{/each}
	</ul>
</PageShell>
