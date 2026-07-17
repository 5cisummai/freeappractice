<script lang="ts">
	import QuestionCard from '$lib/components/questions/question-card.svelte';
	import QuestionSelector from '$lib/components/questions/question-selector.svelte';
	import FrqCard from '$lib/components/questions/frq-card.svelte';
	import type { AnswerResult } from '$lib/questions/types.js';
	import type { FrqAttemptView } from '$lib/frq/types.js';
	import { captureGenerateClicked } from '$lib/client/activation-analytics.js';

	type Props = {
		selectedClass?: string;
		selectedUnit?: string;
		unitRange?: number[];
		requestVersion?: number;
		allowFrq?: boolean;
		mode?: 'mcq' | 'frq';
		onModeChange?: (mode: 'mcq' | 'frq') => void;
		onAnswered?: (result: AnswerResult) => void;
		onFrqGraded?: (attempt: FrqAttemptView) => void;
	};

	let {
		selectedClass = $bindable(''),
		selectedUnit = $bindable(''),
		unitRange = $bindable<number[] | undefined>(undefined),
		requestVersion = $bindable(0),
		allowFrq = false,
		mode = $bindable<'mcq' | 'frq'>('mcq'),
		onModeChange,
		onAnswered,
		onFrqGraded
	}: Props = $props();

	function changeMode(nextMode: 'mcq' | 'frq'): void {
		mode = nextMode;
		requestVersion = 0;
		onModeChange?.(nextMode);
	}

	function generate(): void {
		if (selectedClass) captureGenerateClicked(selectedClass, selectedUnit);
		requestVersion += 1;
	}
</script>

<div class="mx-auto mb-8 max-w-5xl space-y-4">
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
	{/if}
	<QuestionSelector
		bind:selectedClass
		bind:selectedUnit
		bind:unitRange
		onSelectionChange={() => (requestVersion = 0)}
		onGenerate={generate}
	/>
</div>

<div class="mx-auto min-h-40 max-w-6xl">
	{#key `${mode}:${selectedClass}:${selectedUnit}:${requestVersion}`}
		{#if mode === 'frq' && allowFrq}
			<FrqCard {selectedClass} {selectedUnit} {unitRange} {requestVersion} onGraded={onFrqGraded} />
		{:else}
			<QuestionCard {selectedClass} {selectedUnit} {unitRange} {requestVersion} {onAnswered} />
		{/if}
	{/key}
</div>
