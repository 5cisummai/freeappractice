<script lang="ts">
	import apClassesData from '../../routes/data/ap-classes.json';
	import { tick } from 'svelte';
	import BugIcon from '@lucide/svelte/icons/bug';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import BugReportDialog from '$lib/components/bug-report-dialog.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { cn } from '$lib/utils.js';
	import { CUSTOM_UNIT_VALUE } from '$lib/constants/custom-unit';
	import { Input } from '$lib/components/ui/input/index.js';

	type Course = {
		name: string;
		semester1: string[];
		semester2: string[];
	};

	type QuestionSelectorProps = {
		selectedClass?: string;
		selectedUnit?: string;
		/** When the user picks "Custom" unit, they describe the topic here (sent to the API, not cached). */
		customTopic?: string;
		questionType?: 'mcq' | 'frq';
		hideQuestionTypeTabs?: boolean;
		isLoading?: boolean;
		generateLabel?: string;
		onGenerate?: () => void;
		onSelectionChange?: (selectedClass: string, selectedUnit: string) => void;
		onTypeChange?: (type: 'mcq' | 'frq') => void;
	};

	const courses = (apClassesData.courses ?? []) as Course[];

	let {
		selectedClass = $bindable(''),
		selectedUnit = $bindable(''),
		customTopic = $bindable(''),
		questionType = $bindable<'mcq' | 'frq'>('mcq'),
		hideQuestionTypeTabs = false,
		isLoading = false,
		generateLabel = 'Generate Question',
		onGenerate,
		onSelectionChange,
		onTypeChange
	}: QuestionSelectorProps = $props();

	const isCustomUnitSelected = $derived(selectedUnit === CUSTOM_UNIT_VALUE);

	const selectedCourse = $derived(courses.find((c) => c.name === selectedClass));
	const unitOptions = $derived(
		selectedCourse ? [...selectedCourse.semester1, ...selectedCourse.semester2] : []
	);

	let classOpen = $state(false);
	let unitOpen = $state(false);
	let classTriggerRef = $state<HTMLButtonElement>(null!);
	let unitTriggerRef = $state<HTMLButtonElement>(null!);
	let bugReportOpen = $state(false);

	function notifySelectionChange(): void {
		onSelectionChange?.(selectedClass, selectedUnit);
	}

	function selectClass(name: string): void {
		selectedClass = name;
		selectedUnit = '';
		customTopic = '';
		classOpen = false;
		tick().then(() => classTriggerRef?.focus());
		notifySelectionChange();
	}

	function selectUnit(unit: string): void {
		selectedUnit = unit;
		if (unit !== CUSTOM_UNIT_VALUE) customTopic = '';
		unitOpen = false;
		tick().then(() => unitTriggerRef?.focus());
		notifySelectionChange();
	}
</script>

<div class="space-y-4">
	{#if !hideQuestionTypeTabs}
		<div class="flex w-fit gap-1 rounded-lg border border-border/70 bg-muted/30 p-1">
			<button
				type="button"
				onclick={() => {
					questionType = 'mcq';
					onTypeChange?.('mcq');
				}}
				class={cn(
					'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
					questionType === 'mcq'
						? 'bg-background text-foreground shadow-sm'
						: 'text-muted-foreground hover:text-foreground'
				)}
			>
				Multiple Choice
			</button>
			<button
				type="button"
				onclick={() => {
					questionType = 'frq';
					onTypeChange?.('frq');
				}}
				class={cn(
					'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
					questionType === 'frq'
						? 'bg-background text-foreground shadow-sm'
						: 'text-muted-foreground hover:text-foreground'
				)}
			>
				<TriangleAlert class="ml-1 inline-block size-4 text-yellow-500" /> (Alpha) Free Response
			</button>
		</div>
	{/if}

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
								{:else if isCustomUnitSelected}
									{customTopic.trim()
										? customTopic.trim().length > 48
											? `${customTopic.trim().slice(0, 48)}…`
											: customTopic.trim()
										: 'Custom topic'}
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
								<Command.Item value="custom-topic" onSelect={() => selectUnit(CUSTOM_UNIT_VALUE)}>
									<CheckIcon
										class={cn('mr-2 size-4 shrink-0', !isCustomUnitSelected && 'text-transparent')}
									/>
									Custom topic…
								</Command.Item>
							</Command.Group>
						</Command.List>
					</Command.Root>
				</Popover.Content>
			</Popover.Root>
		</div>

		<Button
			onclick={onGenerate}
			disabled={isLoading || !selectedClass || (isCustomUnitSelected && !customTopic.trim())}
			class="h-10 shrink-0 px-4 text-sm"
		>
			{isLoading ? 'Generating...' : generateLabel}
		</Button>
		<Button
			type="button"
			variant="ghost"
			onclick={() => (bugReportOpen = true)}
			class="h-10 shrink-0 px-3 text-sm text-muted-foreground hover:text-foreground"
		>
			<BugIcon class="mr-1.5 size-4" />
			Report bug
		</Button>
	</div>

	{#if selectedClass && isCustomUnitSelected}
		<div class="space-y-2">
			<Label for="custom-topic-input">Topic or subtopic</Label>
			<Input
				id="custom-topic-input"
				placeholder="e.g. Cross-sectional volumes"
				bind:value={customTopic}
				class="max-w-xl"
				autocomplete="off"
			/>
			<p class="text-xs text-muted-foreground">Generated on demand for this topic.</p>
		</div>
	{/if}
</div>

<BugReportDialog bind:open={bugReportOpen} {selectedClass} {selectedUnit} {customTopic} />
