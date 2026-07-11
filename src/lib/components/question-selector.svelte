<script lang="ts">
	import { getCourses } from '$lib/catalog/ap-classes';
	import { tick } from 'svelte';
	import BugIcon from '@lucide/svelte/icons/bug';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import ClipboardCopyIcon from '@lucide/svelte/icons/clipboard-copy';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import BugReportDialog from '$lib/components/bug-report-dialog.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { cn } from '$lib/utils.js';
	import { capturePracticeSelectorUsed } from '$lib/client/activation-analytics';

	type QuestionSelectorProps = {
		selectedClass?: string;
		selectedUnit?: string;
		generateLabel?: string;
		onGenerate?: () => void;
		onSelectionChange?: (selectedClass: string, selectedUnit: string) => void;
	};

	const courses = $derived(getCourses());

	let {
		selectedClass = $bindable(''),
		selectedUnit = $bindable(''),
		generateLabel = 'Generate Question',
		onGenerate,
		onSelectionChange
	}: QuestionSelectorProps = $props();

	const selectedCourse = $derived(courses.find((c) => c.name === selectedClass));
	const unitOptions = $derived(
		selectedCourse ? [...selectedCourse.semester1, ...selectedCourse.semester2] : []
	);

	let classOpen = $state(false);
	let unitOpen = $state(false);
	let classTriggerRef = $state<HTMLButtonElement>(null!);
	let unitTriggerRef = $state<HTMLButtonElement>(null!);
	let bugReportOpen = $state(false);
	let optionsOpen = $state(false);

	function notifySelectionChange(): void {
		onSelectionChange?.(selectedClass, selectedUnit);
		if (selectedClass) capturePracticeSelectorUsed(selectedClass, selectedUnit);
	}

	function selectClass(name: string): void {
		selectedClass = name;
		selectedUnit = '';
		classOpen = false;
		tick().then(() => classTriggerRef?.focus());
		notifySelectionChange();
	}

	function selectUnit(unit: string): void {
		selectedUnit = unit;
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
		optionsOpen = false;
		notifySelectionChange();
	}

	async function copySelection(): Promise<void> {
		if (!selectedClass) return;

		const parts = [selectedClass];
		if (selectedUnit) {
			parts.push(selectedUnit);
		} else {
			parts.push('All Units');
		}

		await navigator.clipboard.writeText(parts.join(' · '));
		optionsOpen = false;
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
			<Popover.Content align="end" class="w-48 gap-0 p-1">
				<div class="flex flex-col gap-0.5">
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
						onclick={copySelection}
						disabled={!selectedClass}
					>
						<ClipboardCopyIcon class="size-4" />
						Copy selection
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
			</Popover.Content>
		</Popover.Root>
	</div>
</div>

<BugReportDialog bind:open={bugReportOpen} {selectedClass} {selectedUnit} />
