<script lang="ts">
	import { onMount } from 'svelte';
	import EllipsisVerticalIcon from '@tabler/icons-svelte/icons/dots-vertical';
	import { invalidateAll } from '$app/navigation';
	import { apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/api.js';
	import type { AdminUserRow } from '$lib/admin/types.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { toast } from 'svelte-sonner';

	let { user, ...restProps }: { user: AdminUserRow } = $props();
	let busy = $state(false);
	let mounted = $state(false);

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
			await invalidateAll();
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

	function revokeSuper() {
		if (!window.confirm('Revoke all active Super grants for this user?')) return;
		void runAction('revoke_super', 'Super grants revoked.');
	}

	function banUser() {
		if (!window.confirm('Ban this user? They will be signed out and cannot sign in.')) return;
		void runAction('ban', 'User banned.');
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
