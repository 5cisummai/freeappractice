<script lang="ts">
	import EllipsisIcon from '@tabler/icons-svelte/icons/dots';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import type { CacheBucketSummary } from '$lib/admin/types.js';

	type Props = {
		bucket: CacheBucketSummary;
		disabled: boolean;
		busy: boolean;
		onRetire: (quantity: number) => void | Promise<void>;
	};

	let { bucket, disabled, busy, onRetire }: Props = $props();

	let open = $state(false);
	let confirmOpen = $state(false);
	let quantity = $state(1);

	const retireCount = $derived(
		Math.min(Math.trunc(Number(quantity)), bucket.activeCount)
	);

	async function retireQuestions(): Promise<void> {
		if (!Number.isInteger(retireCount) || retireCount < 1) return;

		await onRetire(retireCount);
		quantity = 1;
		open = false;
		confirmOpen = false;
	}

	function openConfirm(): void {
		if (!Number.isInteger(retireCount) || retireCount < 1) return;
		confirmOpen = true;
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				variant="ghost"
				size="icon-sm"
				class="text-muted-foreground"
				{disabled}
				aria-label={`Fine tune ${bucket.apClass} ${bucket.unit}`}
			>
				<EllipsisIcon class="size-4" />
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content align="end" class="w-[min(20rem,calc(100vw-2rem))]">
		<Popover.Header>
			<Popover.Title>Fine tune inventory</Popover.Title>
			<Popover.Description>
				Retire the oldest active questions, then queue a refill back to the quota.
			</Popover.Description>
		</Popover.Header>

		<div class="space-y-2">
			<label
				for={`retire-${bucket.questionType}-${bucket.apClass}-${bucket.unit}`}
				class="text-sm font-medium"
			>
				Questions to delete
			</label>
			<div class="flex items-center gap-2">
				<Input
					id={`retire-${bucket.questionType}-${bucket.apClass}-${bucket.unit}`}
					type="number"
					min="1"
					max={bucket.activeCount}
					bind:value={quantity}
					disabled={disabled || busy || bucket.activeCount < 1}
				/>
				<span class="shrink-0 text-xs text-muted-foreground">
					up to {bucket.activeCount.toLocaleString()}
				</span>
			</div>
		</div>

		<Button
			variant="destructive"
			onclick={openConfirm}
			disabled={disabled || busy || bucket.activeCount < 1}
		>
			{busy ? 'Queueing refill…' : 'Delete and queue refill'}
		</Button>
	</Popover.Content>
</Popover.Root>

<AlertDialog.Root bind:open={confirmOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>
				Delete {retireCount} question{retireCount === 1 ? '' : 's'}?
			</AlertDialog.Title>
			<AlertDialog.Description>
				This retires the oldest active {bucket.questionType.toUpperCase()} questions from {bucket.apClass}
				· {bucket.unit}, then queues a refill back to the quota.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel disabled={busy}>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				class="text-destructive-foreground bg-destructive hover:bg-destructive/90"
				disabled={busy}
				onclick={() => void retireQuestions()}
			>
				{bucket.activeCount < 1 ? 'Delete' : busy ? 'Queueing refill…' : 'Delete and queue refill'}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
