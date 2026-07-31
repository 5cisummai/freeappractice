<script lang="ts">
	import QuestionCard from '$lib/components/questions/question-card.svelte';
	import QuestionSelector from '$lib/components/questions/question-selector.svelte';
	import FrqCard from '$lib/components/questions/frq-card.svelte';
	import type { AnswerResult, QuestionCardProps } from '$lib/questions/types';
	import type { FrqAttemptView } from '$lib/frq/types';
	import { captureGenerateClicked } from '$lib/client/activation-analytics';
	import { realisticMode } from '$lib/client/realistic-mode.svelte.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';

	type PracticeShellProps = {
		selectedClass?: string;
		selectedUnit?: string;
		unitRange?: number[];
		requestVersion?: number;
		allowFrq?: boolean;
		mode?: 'mcq' | 'frq';
		generateLabel?: string;
		onGenerate?: () => void;
		onSelectionChange?: (selectedClass: string, selectedUnit: string) => void;
		onModeChange?: (mode: 'mcq' | 'frq') => void;
		onAnswered?: (result: AnswerResult) => void;
		onFrqGraded?: (attempt: FrqAttemptView) => void;
	} & Omit<QuestionCardProps, 'selectedClass' | 'selectedUnit' | 'requestVersion' | 'onAnswered'>;

	let {
		selectedClass = $bindable(''),
		selectedUnit = $bindable(''),
		unitRange = $bindable<number[] | undefined>(undefined),
		requestVersion = $bindable(0),
		allowFrq = false,
		mode = $bindable<'mcq' | 'frq'>('mcq'),
		generateLabel,
		onGenerate,
		onSelectionChange,
		onModeChange,
		onAnswered,
		onFrqGraded,
		...cardProps
	}: PracticeShellProps = $props();

	const showEmptyChrome = $derived(requestVersion === 0);

	function changeMode(nextMode: 'mcq' | 'frq'): void {
		mode = nextMode;
		requestVersion = 0;
		onModeChange?.(nextMode);
	}

	function handleSelectionChange(className: string, unit: string): void {
		requestVersion = 0;
		onSelectionChange?.(className, unit);
	}

	function handleGenerate(): void {
		if (selectedClass) captureGenerateClicked(selectedClass, selectedUnit);
		requestVersion += 1;
		onGenerate?.();
	}
</script>

<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
	{#if allowFrq}
		<div class="flex w-fit gap-1 rounded-lg border border-border/70 bg-muted/30 p-1">
			<button
				type="button"
				class={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${mode === 'mcq' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
				onclick={() => changeMode('mcq')}
			>
				Multiple choice
			</button>
			<button
				type="button"
				class={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${mode === 'frq' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
				onclick={() => changeMode('frq')}
			>
				Written response
			</button>
		</div>
	{:else}
		<div></div>
	{/if}

	<div class="flex items-center gap-3">
		<Label for="exam-mode" class="text-sm font-medium text-muted-foreground">Exam mode</Label>
		<Switch
			id="exam-mode"
			checked={realisticMode.enabled}
			onCheckedChange={(checked: boolean) => realisticMode.setEnabled(checked)}
		/>
	</div>
</div>

<div class="mb-8 space-y-4">
	<QuestionSelector
		bind:selectedClass
		bind:selectedUnit
		bind:unitRange
		{generateLabel}
		onSelectionChange={handleSelectionChange}
		onGenerate={handleGenerate}
	/>
</div>

{#if showEmptyChrome}
	<Card.Root class="mb-8 overflow-hidden rounded-2xl border border-dashed border-border/70 bg-card shadow-none ring-0">
		<Card.Content class="flex flex-col items-center justify-center gap-4 px-6 py-14 text-center">
			<div
				class="flex size-20 items-center justify-center rounded-full bg-primary/10 text-primary"
				aria-hidden="true"
			>
				<BookOpenIcon class="size-9" />
			</div>
			<div class="space-y-1.5">
				<p class="font-display text-xl font-medium tracking-tight">Ready to practice?</p>
				<p class="max-w-md text-sm text-muted-foreground">
					Select a class and unit, then generate a question to get started.
				</p>
			</div>
		</Card.Content>
	</Card.Root>
{/if}

<div class="min-h-40">
	{#if requestVersion > 0}
		{#key `${mode}:${selectedClass}:${selectedUnit}`}
			{#if mode === 'frq' && allowFrq}
				<FrqCard
					{selectedClass}
					{selectedUnit}
					{unitRange}
					{requestVersion}
					onGraded={onFrqGraded}
				/>
			{:else}
				<QuestionCard
					{selectedClass}
					{selectedUnit}
					{unitRange}
					{requestVersion}
					{onAnswered}
					{...cardProps}
				/>
			{/if}
		{/key}
	{/if}
</div>
