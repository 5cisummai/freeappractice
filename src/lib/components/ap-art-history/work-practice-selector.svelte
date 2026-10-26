<script lang="ts">
	import { onMount, tick } from 'svelte';
	import CheckIcon from '@tabler/icons-svelte/icons/check-filled';
	import SelectorIcon from '@tabler/icons-svelte/icons/selector';
	import { fetchApArtHistoryContentAreas } from '#lib/ap-art-history/request.client.js';
	import type { ApArtHistoryContentAreaSummary } from '#lib/ap-art-history/types.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import * as Command from '#lib/components/ui/command/index.js';
	import * as Popover from '#lib/components/ui/popover/index.js';
	import { cn } from '#lib/utils.js';

	let {
		selectedContentArea = $bindable(''),
		generateDisabled = false,
		onGenerate
	}: {
		selectedContentArea?: string;
		generateDisabled?: boolean;
		onGenerate?: () => void;
	} = $props();

	let areas = $state<ApArtHistoryContentAreaSummary[]>([]);
	let areasLoading = $state(true);
	let areasError = $state('');
	let areaOpen = $state(false);
	let areaTriggerRef = $state<HTMLButtonElement>(null!);

	function contentAreaLabel(value: string): string {
		const match = value.match(/^\d+\.\s*(.+)$/);
		return match?.[1]?.trim() ?? value;
	}

	function selectContentArea(value: string): void {
		selectedContentArea = value;
		areaOpen = false;
		tick().then(() => areaTriggerRef?.focus());
	}

	onMount(() => {
		void fetchApArtHistoryContentAreas()
			.then((items) => {
				areas = items;
				if (!selectedContentArea && items[0]) {
					selectedContentArea = items[0].contentArea;
				}
			})
			.catch(() => {
				areasError = 'Could not load content areas.';
			})
			.finally(() => {
				areasLoading = false;
			});
	});
</script>

<div class="space-y-4">
	<div class="flex flex-wrap items-end gap-4">
		<div class="flex min-w-48 flex-1 flex-col gap-2">
			<Label id="apah-content-area-label">Content area</Label>
			<Popover.Root bind:open={areaOpen}>
				<Popover.Trigger bind:ref={areaTriggerRef}>
					{#snippet child({ props })}
						<Button
							{...props}
							variant="outline"
							role="combobox"
							aria-labelledby="apah-content-area-label"
							aria-expanded={areaOpen}
							disabled={areasLoading || Boolean(areasError)}
							class="w-full justify-between font-normal"
						>
							<span class="truncate">
								{#if areasLoading}
									Loading areas…
								{:else if areasError}
									{areasError}
								{:else if selectedContentArea}
									{contentAreaLabel(selectedContentArea)}
								{:else}
									Select a content area
								{/if}
							</span>
							<SelectorIcon class="ml-2 size-4 shrink-0 opacity-50" />
						</Button>
					{/snippet}
				</Popover.Trigger>
				<Popover.Content class="p-0">
					<Command.Root>
						<Command.Input placeholder="Search content areas…" />
						<Command.List>
							<Command.Empty>No content area found.</Command.Empty>
							<Command.Group>
								{#each areas as area (area.contentArea)}
									<Command.Item
										value={area.contentArea}
										onSelect={() => selectContentArea(area.contentArea)}
									>
										<CheckIcon
											class={cn(
												'mr-2 size-4 shrink-0',
												selectedContentArea !== area.contentArea && 'text-transparent'
											)}
										/>
										<span class="truncate">{contentAreaLabel(area.contentArea)}</span>
										<span class="ml-auto text-xs text-muted-foreground">{area.count}</span>
									</Command.Item>
								{/each}
							</Command.Group>
						</Command.List>
					</Command.Root>
				</Popover.Content>
			</Popover.Root>
		</div>

		<Button
			onclick={onGenerate}
			disabled={!selectedContentArea || generateDisabled || areasLoading}
			class="h-10 shrink-0 px-4 text-sm"
		>
			Practice
		</Button>
	</div>
</div>
