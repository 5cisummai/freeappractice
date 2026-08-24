<script lang="ts">
	import { onMount } from 'svelte';
	import EllipsisVerticalIcon from '@tabler/icons-svelte/icons/dots-vertical';
	import { invalidateAppRoute } from '$lib/client/invalidate-data.js';
	import { apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/api.js';
	import type { AdminUserRow } from '$lib/admin/types.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { toast } from 'svelte-sonner';

	let { user, ...restProps }: { user: AdminUserRow } = $props();
	let busy = $state(false);
	let mounted = $state(false);
	let confirmOpen = $state(false);
	let pendingAction = $state<'revoke_super' | 'ban' | null>(null);

	onMount(() => {
		mounted = true;
	});

	async function runAction(
		action: 'grant_super' | 'revoke_super' | 'ban' | 'unban',
		successMessage: string
	) {
		if (busy) return;
		busy = true;
		try {
			const response = await apiFetch('/api/admin/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId: user.id, action })
			});
			const result = await readJsonOrNull<{ error?: string; granted?: boolean; message?: string }>(
				response
			);
			if (!response.ok) throw new Error(getResponseMessage(result, 'Could not update user.'));
			await invalidateAppRoute('/app/admin');
			if (action === 'grant_super' && result?.granted === false) {
				toast.success(result.message ?? 'User already has an indefinite Super grant.');
				return;
			}
			toast.success(successMessage);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not update user.');
		} finally {
			busy = false;
		}
	}

	async function copyUserId() {
		try {
			await navigator.clipboard.writeText(user.id);
			toast.success('User ID copied.');
		} catch {
			toast.error('Could not copy user ID.');
		}
	}

	function grantSuper() {
		void runAction('grant_super', 'Indefinite Super granted.');
	}

	function openConfirm(action: 'revoke_super' | 'ban') {
		pendingAction = action;
		confirmOpen = true;
	}

	async function confirmPendingAction() {
		if (!pendingAction || busy) return;
		const action = pendingAction;
		confirmOpen = false;
		pendingAction = null;
		switch (action) {
			case 'revoke_super':
				await runAction('revoke_super', 'Super grants revoked.');
				break;
			case 'ban':
				await runAction('ban', 'User banned.');
				break;
			default: {
				const exhaustive: never = action;
				return exhaustive;
			}
		}
	}

	function revokeSuper() {
		openConfirm('revoke_super');
	}

	function banUser() {
		openConfirm('ban');
	}

	function unbanUser() {
		void runAction('unban', 'User unbanned.');
	}
</script>

{#if !mounted}
	<Button
		{...restProps}
		variant="ghost"
		size="icon-sm"
		class="text-muted-foreground"
		disabled
		aria-label="User actions"
	>
		<EllipsisVerticalIcon />
	</Button>
{:else}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button
					{...restProps}
					{...props}
					variant="ghost"
					size="icon-sm"
					class="text-muted-foreground"
					disabled={busy}
					aria-label="User actions"
				>
					<EllipsisVerticalIcon />
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end">
			<DropdownMenu.Group>
				<DropdownMenu.Item onclick={copyUserId}>Copy user ID</DropdownMenu.Item>
				<DropdownMenu.Item onclick={grantSuper}>Grant Super</DropdownMenu.Item>
				{#if user.banned}
					<DropdownMenu.Item onclick={unbanUser}>Unban</DropdownMenu.Item>
				{/if}
			</DropdownMenu.Group>
			{#if user.hasAdminGrant || !user.banned}
				<DropdownMenu.Separator />
				<DropdownMenu.Group>
					{#if user.hasAdminGrant}
						<DropdownMenu.Item variant="destructive" onclick={revokeSuper}
							>Revoke Super</DropdownMenu.Item
						>
					{/if}
					{#if !user.banned}
						<DropdownMenu.Item variant="destructive" onclick={banUser}>Ban</DropdownMenu.Item>
					{/if}
				</DropdownMenu.Group>
			{/if}
		</DropdownMenu.Content>
	</DropdownMenu.Root>
{/if}

<AlertDialog.Root bind:open={confirmOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			{#if pendingAction === 'revoke_super'}
				<AlertDialog.Title>Revoke Super grants?</AlertDialog.Title>
				<AlertDialog.Description>
					This revokes all active Super grants for this user. They will lose Super access
					immediately.
				</AlertDialog.Description>
			{:else if pendingAction === 'ban'}
				<AlertDialog.Title>Ban this user?</AlertDialog.Title>
				<AlertDialog.Description>
					They will be signed out and cannot sign in again until unbanned.
				</AlertDialog.Description>
			{/if}
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel disabled={busy}>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				class="text-destructive-foreground bg-destructive hover:bg-destructive/90"
				disabled={busy}
				onclick={() => void confirmPendingAction()}
			>
				{pendingAction === 'revoke_super' ? 'Revoke Super' : 'Ban user'}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
