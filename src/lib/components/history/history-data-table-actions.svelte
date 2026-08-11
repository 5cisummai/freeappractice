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
		if (item.kind === 'quiz') return;
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
			<Button
				{...props}
				variant="ghost"
				size="icon"
				class="relative size-8 p-0"
				aria-label={`Actions for ${item.attempt.apClass} question`}
			>
				<EllipsisIcon class="size-4" />
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end">
		<DropdownMenu.Group>
			<DropdownMenu.Label>Actions</DropdownMenu.Label>
			<DropdownMenu.Item onclick={() => onView(item)}>
				<EyeIcon class="size-4" />
				{item.kind === 'quiz' ? 'View quiz' : 'View question'}
			</DropdownMenu.Item>
			{#if item.kind !== 'quiz'}
				<DropdownMenu.Item onclick={copyQuestionId}>Copy question ID</DropdownMenu.Item>
			{/if}
		</DropdownMenu.Group>
	</DropdownMenu.Content>
</DropdownMenu.Root>
