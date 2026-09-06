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
		onEnqueue: () => void | Promise<void>;
		onCancel: () => void | Promise<void>;
		onRetire: (quantity: number) => void | Promise<void>;
	};

	let { bucket, disabled, busy, onEnqueue, onCancel, onRetire }: Props = $props();

	let open = $state(false);
	let confirmOpen = $state(false);
	let quantity = $state(1);

	const retireCount = $derived(Math.min(Math.trunc(Number(quantity)), bucket.activeCount));
	const canCancelRefill = $derived(
		bucket.refillStatus === 'pending' ||
			bucket.refillStatus === 'failed' ||
			bucket.refillStatus === 'budget_exhausted'
	);
	const canQueueRefill = $derived(
		bucket.refillStatus !== 'pending' && bucket.refillStatus !== 'running'
	);
	const queueLabel = $derived(
		bucket.refillStatus === 'failed' || bucket.refillStatus === 'budget_exhausted'
			? 'Retry refill'
			: 'Queue refill now'
	);
	const cancelLabel = $derived(
		bucket.refillStatus === 'pending' ? 'Cancel pending refill' : 'Clear refill state'
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

	async function enqueueRefill(): Promise<void> {
		open = false;
		await onEnqueue();
	}

	async function cancelRefill(): Promise<void> {
		open = false;
		await onCancel();
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
				aria-label={`Actions for ${bucket.apClass} ${bucket.unit}`}
			>
				<EllipsisIcon class="size-4" />
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content align="end" class="w-[min(20rem,calc(100vw-2rem))]">
		<Popover.Header>
			<Popover.Title>Pool actions</Popover.Title>
			<Popover.Description>
				Manage the refill state or retire the oldest active questions in this bucket.
			</Popover.Description>
		</Popover.Header>

		<div class="space-y-2">
			<p class="text-sm font-medium">Refill queue</p>
			<div class="flex flex-col gap-2">
				<Button
					variant="outline"
					class="justify-start"
					onclick={() => void enqueueRefill()}
					disabled={disabled || busy || !canQueueRefill}
				>
					{queueLabel}
				</Button>
				{#if canCancelRefill}
					<Button
						variant="ghost"
						class="justify-start text-destructive hover:text-destructive"
						onclick={() => void cancelRefill()}
						disabled={disabled || busy}
					>
						{cancelLabel}
					</Button>
				{:else if bucket.refillStatus === 'running'}
					<p class="text-xs text-muted-foreground">A worker is currently processing this refill.</p>
				{/if}
			</div>
		</div>

		<div class="border-t border-border/70 pt-3">
			<p class="mb-2 text-sm font-medium">Retire questions</p>
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
		</div>
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
