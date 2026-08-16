<script lang="ts">
	import EllipsisVerticalIcon from '@lucide/svelte/icons/ellipsis-vertical';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/api.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { cn } from '$lib/utils.js';
	import { toast } from 'svelte-sonner';

	type CoachConversation = {
		id: string;
		title: string;
	};

	let {
		conversation,
		disabled = false,
		class: className,
		onRenamed,
		onDeleted
	}: {
		conversation: CoachConversation;
		disabled?: boolean;
		class?: string;
		onRenamed?: (conversation: CoachConversation) => void;
		onDeleted?: (conversationId: string) => void;
	} = $props();

	let menuOpen = $state(false);
	let renameOpen = $state(false);
	let deleteOpen = $state(false);
	let renameValue = $state('');
	let busy = $state(false);

	function openRenameDialog() {
		menuOpen = false;
		renameValue = conversation.title;
		renameOpen = true;
	}

	function openDeleteDialog() {
		menuOpen = false;
		deleteOpen = true;
	}

	function stopRowActivation(event: Event) {
		event.preventDefault();
		event.stopPropagation();
	}

	function stopTriggerPropagation(event: MouseEvent, onclick: unknown) {
		event.stopPropagation();
		if (typeof onclick === 'function') onclick(event);
	}

	async function confirmRename() {
		const title = renameValue.trim();
		if (!title || busy) return;
		busy = true;
		try {
			const response = await apiFetch(`/api/super/conversations/${conversation.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title })
			});
			const payload = await readJsonOrNull<{ title?: string; error?: string }>(response);
			if (!response.ok || !payload?.title) {
				throw new Error(getResponseMessage(payload, 'Could not rename that conversation.'));
			}
			onRenamed?.({ ...conversation, title: payload.title });
			renameOpen = false;
			toast.success('Conversation renamed.');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not rename that conversation.');
		} finally {
			busy = false;
		}
	}

	async function confirmDelete() {
		if (busy) return;
		busy = true;
		try {
			const response = await apiFetch(`/api/super/conversations/${conversation.id}`, {
				method: 'DELETE'
			});
			const payload = await readJsonOrNull<{ error?: string }>(response);
			if (!response.ok) {
				throw new Error(getResponseMessage(payload, 'Could not delete that conversation.'));
			}
			deleteOpen = false;
			onDeleted?.(conversation.id);
			toast.success('Conversation deleted.');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not delete that conversation.');
		} finally {
			busy = false;
		}
	}
</script>

<DropdownMenu.Root bind:open={menuOpen}>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				variant="ghost"
				size="icon-sm"
				class={cn('shrink-0 text-muted-foreground', className)}
				disabled={disabled || busy}
				aria-label="Conversation actions"
				onclick={(event) => stopTriggerPropagation(event, props.onclick)}
			>
				<EllipsisVerticalIcon class="size-4" aria-hidden="true" />
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end" class="w-40" onclick={stopRowActivation}>
		<DropdownMenu.Group>
			<DropdownMenu.Item onclick={openRenameDialog}>
				<PencilIcon aria-hidden="true" />
				Rename
			</DropdownMenu.Item>
			<DropdownMenu.Item variant="destructive" onclick={openDeleteDialog}>
				<Trash2Icon aria-hidden="true" />
				Delete
			</DropdownMenu.Item>
		</DropdownMenu.Group>
	</DropdownMenu.Content>
</DropdownMenu.Root>

<AlertDialog.Root bind:open={renameOpen}>
	<AlertDialog.Content onclick={stopRowActivation}>
		<AlertDialog.Header>
			<AlertDialog.Title>Rename conversation</AlertDialog.Title>
			<AlertDialog.Description
				>Choose a short title you will recognize later.</AlertDialog.Description
			>
		</AlertDialog.Header>
		<Input
			bind:value={renameValue}
			maxlength={160}
			placeholder="Conversation title"
			disabled={busy}
			onkeydown={(event) => {
				if (event.key === 'Enter') {
					event.preventDefault();
					void confirmRename();
				}
			}}
		/>
		<AlertDialog.Footer>
			<AlertDialog.Cancel disabled={busy}>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				disabled={busy || !renameValue.trim()}
				onclick={() => void confirmRename()}
			>
				Save
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<AlertDialog.Root bind:open={deleteOpen}>
	<AlertDialog.Content onclick={stopRowActivation}>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete conversation?</AlertDialog.Title>
			<AlertDialog.Description>
				This removes <span class="ph-mask-pii font-medium text-foreground"
					>{conversation.title}</span
				>
				and its messages. This cannot be undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel disabled={busy}>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				class="bg-destructive text-white hover:bg-destructive/90"
				disabled={busy}
				onclick={() => void confirmDelete()}
			>
				Delete
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
