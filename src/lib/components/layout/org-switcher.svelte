<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { authClient } from '$lib/auth/client.js';
	import {
		MAX_FREE_GROUP_ORGS,
		orgAvatarClass,
		orgAvatarLetter,
		slugifyOrgName,
		type UserOrganization
	} from '$lib/auth/organization-types';
	import { apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/api.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Field, FieldGroup, FieldLabel } from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { toast } from 'svelte-sonner';

	let {
		organizations,
		activeOrganization,
		ownedGroupCount
	}: {
		organizations: UserOrganization[];
		activeOrganization: UserOrganization | null;
		ownedGroupCount: number;
	} = $props();

	const active = $derived(activeOrganization ?? organizations[0] ?? null);
	const canCreate = $derived(ownedGroupCount < MAX_FREE_GROUP_ORGS);

	let createOpen = $state(false);
	let renameOpen = $state(false);
	let deleteOpen = $state(false);
	let inviteOpen = $state(false);
	let targetOrg = $state<UserOrganization | null>(null);
	let createName = $state('');
	let renameName = $state('');
	let inviteEmail = $state('');
	let busy = $state(false);

	function openCreate() {
		createName = '';
		createOpen = true;
	}

	function openRename(org: UserOrganization) {
		targetOrg = org;
		renameName = org.name;
		renameOpen = true;
	}

	function openDelete(org: UserOrganization) {
		targetOrg = org;
		deleteOpen = true;
	}

	function openInvite(org: UserOrganization) {
		targetOrg = org;
		inviteEmail = '';
		inviteOpen = true;
	}

	async function switchOrg(organizationId: string) {
		if (organizationId === active?.id) return;
		const { error } = await authClient.organization.setActive({ organizationId });
		if (error) {
			toast.error(error.message ?? 'Could not switch organizations.');
			return;
		}
		await invalidateAll();
	}

	async function createGroup() {
		const name = createName.trim();
		if (!name || busy) return;
		busy = true;
		try {
			const suffix = crypto.randomUUID().slice(0, 6);
			const { error } = await authClient.organization.create({
				name,
				slug: slugifyOrgName(name, suffix),
				orgType: 'group'
			});
			if (error) {
				throw new Error(error.message ?? 'Could not create that organization.');
			}
			createOpen = false;
			toast.success('Organization created.');
			await invalidateAll();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not create that organization.');
		} finally {
			busy = false;
		}
	}

	async function renameGroup() {
		const name = renameName.trim();
		if (!targetOrg || !name || busy) return;
		busy = true;
		try {
			const { error } = await authClient.organization.update({
				organizationId: targetOrg.id,
				data: { name }
			});
			if (error) {
				throw new Error(error.message ?? 'Could not rename that organization.');
			}
			renameOpen = false;
			toast.success('Organization renamed.');
			await invalidateAll();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not rename that organization.');
		} finally {
			busy = false;
		}
	}

	async function deleteGroup() {
		if (!targetOrg || busy) return;
		busy = true;
		try {
			const { error } = await authClient.organization.delete({
				organizationId: targetOrg.id
			});
			if (error) {
				throw new Error(error.message ?? 'Could not delete that organization.');
			}
			deleteOpen = false;
			toast.success('Organization deleted.');
			await invalidateAll();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not delete that organization.');
		} finally {
			busy = false;
		}
	}

	async function leaveGroup(org: UserOrganization) {
		const { error } = await authClient.organization.leave({ organizationId: org.id });
		if (error) {
			toast.error(error.message ?? 'Could not leave that organization.');
			return;
		}
		toast.success('Left organization.');
		await invalidateAll();
	}

	async function copyInviteLink(org: UserOrganization) {
		try {
			const response = await apiFetch('/api/orgs/invite-link', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ organizationId: org.id })
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
		if (!targetOrg || !email || busy) return;
		busy = true;
		try {
			const { error } = await authClient.organization.inviteMember({
				email,
				role: 'member',
				organizationId: targetOrg.id
			});
			if (error) {
				throw new Error(error.message ?? 'Could not send that invite.');
			}
			inviteEmail = '';
			toast.success('Invite sent.');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not send that invite.');
		} finally {
			busy = false;
		}
	}
</script>

{#if active}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger
			class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
		>
			<span
				class="flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold {orgAvatarClass(
					active.id
				)}"
			>
				{orgAvatarLetter(active.name)}
			</span>
			<span class="min-w-0 flex-1 truncate font-medium">{active.name}</span>
			<ChevronsUpDownIcon class="size-4 shrink-0 text-muted-foreground" />
		</DropdownMenu.Trigger>
		<DropdownMenu.Content class="w-64 min-w-56" align="start" side="bottom">
			<DropdownMenu.Group>
				{#each organizations as org (org.id)}
					<div class="flex items-center">
						<DropdownMenu.Item class="min-w-0 flex-1" onclick={() => switchOrg(org.id)}>
							<span
								class="flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold {orgAvatarClass(
									org.id
								)}"
							>
								{orgAvatarLetter(org.name)}
							</span>
							<span class="min-w-0 flex-1 truncate">{org.name}</span>
							{#if org.id === active.id}
								<CheckIcon class="size-4 shrink-0" />
							{/if}
						</DropdownMenu.Item>
						{#if org.orgType === 'group'}
							<DropdownMenu.Sub>
								<DropdownMenu.SubTrigger
									class="size-8 shrink-0 justify-center p-0 [&>svg:last-child]:hidden"
									aria-label="Organization actions"
								>
									<EllipsisIcon class="size-4" />
								</DropdownMenu.SubTrigger>
								<DropdownMenu.SubContent>
									{#if org.role === 'owner' || org.role === 'admin'}
										<DropdownMenu.Item onclick={() => openInvite(org)}>
											<CopyIcon />
											Open invite dialog
										</DropdownMenu.Item>
									{/if}
									{#if org.role === 'owner'}
										<DropdownMenu.Item onclick={() => openRename(org)}>
											<PencilIcon />
											Rename
										</DropdownMenu.Item>
									{/if}
									<DropdownMenu.Item onclick={() => leaveGroup(org)}>
										<LogOutIcon />
										Leave
									</DropdownMenu.Item>
									{#if org.role === 'owner'}
										<DropdownMenu.Item variant="destructive" onclick={() => openDelete(org)}>
											<Trash2Icon />
											Delete
										</DropdownMenu.Item>
									{/if}
								</DropdownMenu.SubContent>
							</DropdownMenu.Sub>
						{/if}
					</div>
				{/each}
			</DropdownMenu.Group>
			<DropdownMenu.Separator />
			<DropdownMenu.Item disabled={!canCreate} onclick={openCreate}>
				<PlusIcon />
				Create organization
			</DropdownMenu.Item>
			{#if !canCreate}
				<p class="px-2 pb-1 text-xs text-muted-foreground">
					You can create up to {MAX_FREE_GROUP_ORGS} free group organizations.
				</p>
			{/if}
		</DropdownMenu.Content>
	</DropdownMenu.Root>
{/if}

<Dialog.Root bind:open={createOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Create organization</Dialog.Title>
			<Dialog.Description>Start a group space to practice with friends.</Dialog.Description>
		</Dialog.Header>
		<FieldGroup>
			<Field>
				<FieldLabel for="org-create-name">Name</FieldLabel>
				<Input
					id="org-create-name"
					bind:value={createName}
					placeholder="AP Bio squad"
					maxlength={80}
				/>
			</Field>
		</FieldGroup>
		<Dialog.Footer>
			<Button type="button" variant="outline" onclick={() => (createOpen = false)}>Cancel</Button>
			<Button type="button" onclick={createGroup} disabled={busy || !createName.trim()}>
				{#if busy}<Spinner data-icon="inline-start" />{/if}
				Create
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={renameOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Rename organization</Dialog.Title>
			<Dialog.Description>Choose a new name for this group.</Dialog.Description>
		</Dialog.Header>
		<FieldGroup>
			<Field>
				<FieldLabel for="org-rename-name">Name</FieldLabel>
				<Input id="org-rename-name" bind:value={renameName} maxlength={80} />
			</Field>
		</FieldGroup>
		<Dialog.Footer>
			<Button type="button" variant="outline" onclick={() => (renameOpen = false)}>Cancel</Button>
			<Button type="button" onclick={renameGroup} disabled={busy || !renameName.trim()}>
				{#if busy}<Spinner data-icon="inline-start" />{/if}
				Save
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={inviteOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Invite people</Dialog.Title>
			<Dialog.Description>
				Copy a link anyone with an account can use, or email a specific person.
			</Dialog.Description>
		</Dialog.Header>
		<FieldGroup>
			<Button
				type="button"
				variant="outline"
				onclick={() => targetOrg && copyInviteLink(targetOrg)}
			>
				<CopyIcon />
				Copy invite link
			</Button>
			<Field>
				<FieldLabel for="org-invite-email">Email</FieldLabel>
				<Input
					id="org-invite-email"
					type="email"
					bind:value={inviteEmail}
					placeholder="friend@example.com"
				/>
			</Field>
		</FieldGroup>
		<Dialog.Footer>
			<Button type="button" variant="outline" onclick={() => (inviteOpen = false)}>Close</Button>
			<Button type="button" onclick={sendInviteEmail} disabled={busy || !inviteEmail.trim()}>
				{#if busy}<Spinner data-icon="inline-start" />{/if}
				Send invite
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<AlertDialog.Root bind:open={deleteOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete {targetOrg?.name ?? 'this organization'}?</AlertDialog.Title>
			<AlertDialog.Description>
				This removes the group and its memberships. Practice progress stays on your account.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action onclick={deleteGroup} disabled={busy}>Delete</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
