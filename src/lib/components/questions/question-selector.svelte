<script lang="ts">
	import { getCourses } from '$lib/catalog/ap-classes';
	import { getFocusedPracticeHref } from '$lib/catalog/practice-pages';
	import { tick } from 'svelte';
	import BugIcon from '@lucide/svelte/icons/bug';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import Share2Icon from '@lucide/svelte/icons/share-2';
	import SlidersHorizontalIcon from '@lucide/svelte/icons/sliders-horizontal';
	import BugReportDialog from '$lib/components/bug-report-dialog.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Slider } from '$lib/components/ui/slider/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { cn } from '$lib/utils.js';
	import { capturePracticeSelectorUsed } from '$lib/client/activation-analytics';
	import { capturePostHogEvent } from '$lib/client/posthog-analytics';
	import { realisticMode } from '$lib/client/realistic-mode.svelte.js';

	type QuestionSelectorProps = {
		selectedClass?: string;
		selectedUnit?: string;
		unitRange?: number[];
		generateLabel?: string;
		onGenerate?: () => void;
		onSelectionChange?: (selectedClass: string, selectedUnit: string) => void;
	};

	const courses = $derived(getCourses());

	let {
		selectedClass = $bindable(''),
		selectedUnit = $bindable(''),
		unitRange = $bindable<number[] | undefined>(undefined),
		generateLabel = 'Generate Question',
		onGenerate,
		onSelectionChange
	}: QuestionSelectorProps = $props();

	const selectedCourse = $derived(courses.find((c) => c.name === selectedClass));
	const unitOptions = $derived(
		selectedCourse ? [...selectedCourse.semester1, ...selectedCourse.semester2] : []
	);
	const shareHref = $derived(getFocusedPracticeHref(selectedClass, selectedUnit));
	const shareText = $derived(
		selectedUnit
			? `Practice ${selectedClass}, ${selectedUnit}, with your AP class.`
			: `Practice ${selectedClass} with your AP class.`
	);
	const unitRangeStart = $derived(unitRange?.[0] ?? 0);
	const unitRangeEnd = $derived(unitRange?.[1] ?? Math.max(unitOptions.length - 1, 0));

	let classOpen = $state(false);
	let unitOpen = $state(false);
	let classTriggerRef = $state<HTMLButtonElement>(null!);
	let unitTriggerRef = $state<HTMLButtonElement>(null!);
	let bugReportOpen = $state(false);
	let optionsOpen = $state(false);
	let shareStatus = $state('');

	function notifySelectionChange(): void {
		shareStatus = '';
		onSelectionChange?.(selectedClass, selectedUnit);
		if (selectedClass) capturePracticeSelectorUsed(selectedClass, selectedUnit);
	}

	function selectClass(name: string): void {
		selectedClass = name;
		selectedUnit = '';
		unitRange = undefined;
		classOpen = false;
		tick().then(() => classTriggerRef?.focus());
		notifySelectionChange();
	}

	function selectUnit(unit: string): void {
		selectedUnit = unit;
		unitRange = undefined;
		unitOpen = false;
		tick().then(() => unitTriggerRef?.focus());
		notifySelectionChange();
	}

	function selectCustomRange(): void {
		if (!unitOptions.length) return;

		selectedUnit = '';
		unitRange = [0, unitOptions.length - 1];
		unitOpen = false;
		tick().then(() => unitTriggerRef?.focus());
		notifySelectionChange();
	}

	function openBugReport(): void {
		optionsOpen = false;
		bugReportOpen = true;
	}

	function clearSelection(): void {
		selectedClass = '';
		selectedUnit = '';
		unitRange = undefined;
		optionsOpen = false;
		notifySelectionChange();
	}

	function captureShareIntent(method: 'clipboard' | 'native_share'): void {
		capturePostHogEvent('practice_page_share_intent', {
			ap_class: selectedClass,
			unit: selectedUnit || undefined,
			page_type: selectedUnit ? 'unit' : 'class',
			method
		});
	}

	function wasShareDismissed(error: unknown): boolean {
		return error instanceof DOMException && error.name === 'AbortError';
	}

	async function copyPracticeLink(url: string): Promise<void> {
		captureShareIntent('clipboard');

		if (!navigator.clipboard?.writeText) {
			shareStatus = 'Could not copy the link. Please try again.';
			return;
		}

		try {
			await navigator.clipboard.writeText(url);
			shareStatus = 'Link copied.';
		} catch {
			shareStatus = 'Could not copy the link. Please try again.';
		}
	}

	async function sharePracticePage(): Promise<void> {
		if (!selectedClass || !shareHref) return;

		const url = new URL(shareHref, window.location.origin).toString();
		shareStatus = '';

		if (navigator.share) {
			captureShareIntent('native_share');
			optionsOpen = false;

			try {
				await navigator.share({
					title: `Free ${selectedClass} practice`,
					text: shareText,
					url
				});
				return;
			} catch (error) {
				if (wasShareDismissed(error)) return;
			}
		}

		await copyPracticeLink(url);
	}

	async function copyCurrentPracticeLink(): Promise<void> {
		if (!shareHref) return;

		shareStatus = '';
		await copyPracticeLink(new URL(shareHref, window.location.origin).toString());
	}
</script>

<div class="space-y-4">
	<div class="flex flex-wrap items-end gap-4">
		<div class="flex min-w-48 flex-1 flex-col gap-2">
			<Label id="question-selector-class-label">AP Class</Label>
			<Popover.Root bind:open={classOpen}>
				<Popover.Trigger bind:ref={classTriggerRef}>
					{#snippet child({ props })}
						<Button
							{...props}
							variant="outline"
							role="combobox"
							aria-labelledby="question-selector-class-label"
							aria-expanded={classOpen}
							class="w-full justify-between font-normal"
						>
							<span class="truncate">{selectedClass || 'Select a course'}</span>
							<ChevronsUpDownIcon class="ml-2 size-4 shrink-0 opacity-50" />
						</Button>
					{/snippet}
				</Popover.Trigger>
				<Popover.Content class="p-0">
					<Command.Root>
						<Command.Input
							id="question-selector-class-search"
							name="class-search"
							placeholder="Search courses..."
						/>
						<Command.List>
							<Command.Empty>No course found.</Command.Empty>
							<Command.Group>
								{#each courses as course (course.name)}
									<Command.Item value={course.name} onSelect={() => selectClass(course.name)}>
										<CheckIcon
											class={cn(
												'mr-2 size-4 shrink-0',
												selectedClass !== course.name && 'text-transparent'
											)}
										/>
										{course.name}
									</Command.Item>
								{/each}
							</Command.Group>
						</Command.List>
					</Command.Root>
				</Popover.Content>
			</Popover.Root>
		</div>

		<div class="flex min-w-48 flex-1 flex-col gap-2">
			<Label id="question-selector-unit-label">Unit</Label>
			<Popover.Root bind:open={unitOpen}>
				<Popover.Trigger bind:ref={unitTriggerRef}>
					{#snippet child({ props })}
						<Button
							{...props}
							variant="outline"
							role="combobox"
							aria-labelledby="question-selector-unit-label"
							aria-expanded={unitOpen}
							disabled={!selectedClass}
							class="w-full justify-between font-normal"
						>
							<span class="truncate">
								{#if !selectedClass}
									Select a course first
								{:else if unitRange}
									Custom range
								{:else if !selectedUnit}
									All Units
								{:else}
									{selectedUnit}
								{/if}
							</span>
							<ChevronsUpDownIcon class="ml-2 size-4 shrink-0 opacity-50" />
						</Button>
					{/snippet}
				</Popover.Trigger>
				<Popover.Content class="p-0">
					<Command.Root>
						<Command.Input
							id="question-selector-unit-search"
							name="unit-search"
							placeholder="Search units..."
						/>
						<Command.List>
							<Command.Empty>No unit found.</Command.Empty>
							<Command.Group>
								<Command.Item value="" onSelect={() => selectUnit('')}>
									<CheckIcon
										class={cn('mr-2 size-4 shrink-0', selectedUnit !== '' && 'text-transparent')}
									/>
									All Units
								</Command.Item>
								{#each unitOptions as unit (unit)}
									<Command.Item value={unit} onSelect={() => selectUnit(unit)}>
										<CheckIcon
											class={cn(
												'mr-2 size-4 shrink-0',
												selectedUnit !== unit && 'text-transparent'
											)}
										/>
										{unit}
									</Command.Item>
								{/each}
							</Command.Group>
							<div class="my-1 h-px bg-border" aria-hidden="true"></div>
							<Command.Group>
								<Command.Item value="custom-range" onSelect={selectCustomRange}>
									<SlidersHorizontalIcon class="mr-2 size-4" />
									Custom range
								</Command.Item>
							</Command.Group>
						</Command.List>
					</Command.Root>
				</Popover.Content>
			</Popover.Root>
		</div>

		<Button onclick={onGenerate} disabled={!selectedClass} class="h-10 shrink-0 px-4 text-sm">
			{generateLabel}
		</Button>
		<Popover.Root bind:open={optionsOpen}>
			<Popover.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						type="button"
						variant="ghost"
						size="icon"
						class="size-10 shrink-0 text-muted-foreground hover:text-foreground"
					>
						<span class="sr-only">More options</span>
						<EllipsisIcon class="size-4" />
					</Button>
				{/snippet}
			</Popover.Trigger>
			<Popover.Content align="end" class="w-52 gap-0 p-1">
				<div class="flex flex-col gap-0.5">
					<div class="flex h-9 items-center justify-between gap-3 px-2">
						<Label for="realistic-mode-toggle" class="text-sm font-normal">Realistic mode</Label>
						<Switch
							id="realistic-mode-toggle"
							size="sm"
							checked={realisticMode.enabled}
							onCheckedChange={(checked) => realisticMode.setEnabled(checked)}
						/>
					</div>
					<div class="my-0.5 h-px bg-border" aria-hidden="true"></div>
					<Button
						type="button"
						variant="ghost"
						class="h-9 w-full justify-start gap-2 px-2 font-normal"
						onclick={openBugReport}
					>
						<BugIcon class="size-4" />
						Report bug
					</Button>
					<Button
						type="button"
						variant="ghost"
						class="h-9 w-full justify-start gap-2 px-2 font-normal"
						onclick={sharePracticePage}
						disabled={!shareHref}
					>
						<Share2Icon class="size-4" />
						Share with your AP class
					</Button>
					<Button
						type="button"
						variant="ghost"
						class="h-9 w-full justify-start gap-2 px-2 font-normal"
						onclick={copyCurrentPracticeLink}
						disabled={!shareHref}
					>
						<CopyIcon class="size-4" />
						Copy practice link
					</Button>
					<Button
						type="button"
						variant="ghost"
						class="h-9 w-full justify-start gap-2 px-2 font-normal"
						onclick={clearSelection}
						disabled={!selectedClass && !selectedUnit}
					>
						<RotateCcwIcon class="size-4" />
						Clear selection
					</Button>
				</div>
				{#if shareStatus}
					<p class="px-2 pt-1 text-xs text-muted-foreground" aria-live="polite">
						{shareStatus}
					</p>
				{/if}
			</Popover.Content>
		</Popover.Root>
	</div>

	{#if unitRange && unitOptions.length > 0}
		<div class="mx-auto max-w-3xl rounded-lg border border-border/70 bg-muted/30 px-4 py-3">
			<Slider
				bind:value={unitRange}
				type="multiple"
				min={0}
				max={unitOptions.length - 1}
				step={1}
				aria-label="Custom unit range"
				class="pt-2"
			/>
			<div class="mt-2 flex justify-between text-xs text-muted-foreground">
				<span>{unitOptions[unitRangeStart]}</span>
				<span>{unitOptions[unitRangeEnd]}</span>
			</div>
		</div>
	{/if}
</div>

<BugReportDialog bind:open={bugReportOpen} {selectedClass} {selectedUnit} />
