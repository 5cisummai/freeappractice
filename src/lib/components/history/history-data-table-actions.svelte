<script lang="ts">
	import type { HistoryItem } from '$lib/users/types.js';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { toast } from 'svelte-sonner';

	let {
		item,
		onView
	}: {
		item: HistoryItem;
		onView: (item: HistoryItem) => void;
	} = $props();

	async function copyQuestionId(): Promise<void> {
		if (!navigator.clipboard?.writeText) {
			toast.error('Could not copy the question ID. Please try again.');
			return;
		}

		try {
			await navigator.clipboard.writeText(item.attempt.questionId);
			toast.success('Question ID copied.');
		} catch {
			toast.error('Could not copy the question ID. Please try again.');
		}
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="ghost" size="icon" class="relative size-8 p-0">
				<span class="sr-only">Open menu</span>
				<EllipsisIcon class="size-4" />
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end">
		<DropdownMenu.Group>
			<DropdownMenu.Label>Actions</DropdownMenu.Label>
			<DropdownMenu.Item onclick={() => onView(item)}>
				<EyeIcon class="size-4" />
				View question
			</DropdownMenu.Item>
			<DropdownMenu.Item onclick={copyQuestionId}>Copy question ID</DropdownMenu.Item>
		</DropdownMenu.Group>
	</DropdownMenu.Content>
</DropdownMenu.Root>
