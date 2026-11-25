<script lang="ts">
	import type { Snippet } from 'svelte';
	import IconArrowBackUp from '@tabler/icons-svelte/icons/arrow-back-up';
	import IconCopy from '@tabler/icons-svelte/icons/copy';
	import IconDots from '@tabler/icons-svelte/icons/dots';
	import IconMoodSmile from '@tabler/icons-svelte/icons/mood-smile';
	import IconMoodPlus from '@tabler/icons-svelte/icons/mood-plus';
	import * as ContextMenu from '#lib/components/ui/context-menu/index.js';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';

	const quickReactions = ['❤️', '👍', '👎', '😂', '🎉'] as const;
	const actionClass =
		'inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring';

	type ExtraAction = {
		label: string;
		onSelect: () => void;
		disabled?: boolean;
	};

	let {
		messageId,
		content,
		onReaction,
		onReply,
		outgoing,
		extraActions = [],
		children
	}: {
		messageId: string;
		content: string;
		onReaction: (emoji: string) => void;
		onReply?: () => void;
		outgoing: boolean;
		extraActions?: ExtraAction[];
		children: Snippet;
	} = $props();

	async function copyText(text: string) {
		try {
			await navigator.clipboard.writeText(text);
		} catch {
			// Clipboard may be unavailable outside a secure context.
		}
	}
</script>

<div
	class={['pip-message-row flex w-full min-w-0 items-center', outgoing && 'flex-row-reverse']}
>
	<ContextMenu.Root>
		<ContextMenu.Trigger class="w-fit max-w-[80%] min-w-0">
			{@render children()}
		</ContextMenu.Trigger>
		<ContextMenu.Content
			class="min-w-56 overflow-hidden rounded-xl border border-border bg-popover p-0 shadow-md ring-0"
		>
			<div class="flex items-center justify-between gap-0.5 px-3 py-2.5">
				{#each quickReactions as emoji (emoji)}
					<button
						type="button"
						class="flex size-9 shrink-0 items-center justify-center rounded-lg text-xl transition-colors hover:bg-muted"
						onclick={() => onReaction(emoji)}
					>
						{emoji}
					</button>
				{/each}
				<button
					type="button"
					class="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted"
					aria-label="More reactions"
					disabled
				>
					<IconMoodPlus class="size-5" />
				</button>
			</div>
			<ContextMenu.Separator class="mx-0 my-0" />
			<div class="p-1">
				{#if onReply}
					<ContextMenu.Item class="gap-2.5 rounded-lg px-2.5 py-2" onSelect={onReply}>
						<IconArrowBackUp class="size-4 text-muted-foreground" />
						Reply
					</ContextMenu.Item>
				{/if}
				<ContextMenu.Item class="gap-2.5 rounded-lg px-2.5 py-2" onSelect={() => copyText(content)}>
					<IconCopy class="size-4 text-muted-foreground" />
					Copy
				</ContextMenu.Item>
				<ContextMenu.Item
					class="gap-2.5 rounded-lg px-2.5 py-2"
					onSelect={() => copyText(messageId)}
				>
					<IconCopy class="size-4 text-muted-foreground" />
					Copy message ID
				</ContextMenu.Item>
				{#each extraActions as action (action.label)}
					<ContextMenu.Item
						class="gap-2.5 rounded-lg px-2.5 py-2"
						disabled={action.disabled}
						onSelect={action.onSelect}
					>
						{action.label}
					</ContextMenu.Item>
				{/each}
			</div>
		</ContextMenu.Content>
	</ContextMenu.Root>

	<div class="pip-message-actions flex shrink-0 items-center px-1">
		<DropdownMenu.Root>
			<DropdownMenu.Trigger class={actionClass} aria-label="React to message" title="React">
				<IconMoodSmile class="size-4" />
			</DropdownMenu.Trigger>
			<DropdownMenu.Content aria-label="Reactions" class="flex w-auto min-w-0">
				{#each quickReactions as emoji (emoji)}
					<DropdownMenu.Item
						class="size-8 justify-center p-0 text-lg"
						onSelect={() => onReaction(emoji)}
					>
						{emoji}
					</DropdownMenu.Item>
				{/each}
			</DropdownMenu.Content>
		</DropdownMenu.Root>
		{#if onReply}
			<button
				type="button"
				class={actionClass}
				aria-label="Reply to message"
				title="Reply"
				onclick={onReply}
			>
				<IconArrowBackUp class="size-4" />
			</button>
		{/if}
		<DropdownMenu.Root>
			<DropdownMenu.Trigger
				class={actionClass}
				aria-label="More message actions"
				title="More actions"
			>
				<IconDots class="size-4" />
			</DropdownMenu.Trigger>
			<DropdownMenu.Content aria-label="More message actions" class="w-max">
				<DropdownMenu.Item onSelect={() => copyText(content)}>Copy</DropdownMenu.Item>
				<DropdownMenu.Item onSelect={() => copyText(messageId)}>Copy message ID</DropdownMenu.Item>
				{#each extraActions as action (action.label)}
					<DropdownMenu.Item disabled={action.disabled} onSelect={action.onSelect}
						>{action.label}</DropdownMenu.Item
					>
				{/each}
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>
</div>
