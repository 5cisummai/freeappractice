<script lang="ts">
	import { captureGenerateClicked } from '$lib/client/activation-analytics';
	import QuestionCard from '$lib/components/question-card.svelte';
	import QuestionSelector from '$lib/components/question-selector.svelte';
	import type { QuestionCardProps } from '$lib/questions/types';

	type QuestionShellProps = {
		selectedClass?: string;
		selectedUnit?: string;
		unitRange?: number[];
		requestVersion?: number;
		generateLabel?: string;
		onGenerate?: () => void;
		onSelectionChange?: (selectedClass: string, selectedUnit: string) => void;
	} & Omit<QuestionCardProps, 'selectedClass' | 'selectedUnit' | 'requestVersion'>;

	let {
		selectedClass = $bindable(''),
		selectedUnit = $bindable(''),
		unitRange = $bindable<number[] | undefined>(undefined),
		requestVersion = $bindable(0),
		generateLabel,
		onGenerate,
		onSelectionChange,
		...cardProps
	}: QuestionShellProps = $props();

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

<div class="mx-auto mb-8 max-w-5xl">
	<QuestionSelector
		bind:selectedClass
		bind:selectedUnit
		bind:unitRange
		{generateLabel}
		onSelectionChange={handleSelectionChange}
		onGenerate={handleGenerate}
	/>
</div>

<div class="mx-auto min-h-40 max-w-6xl">
	{#key `${selectedClass}:${selectedUnit}:${requestVersion}`}
		<QuestionCard {selectedClass} {selectedUnit} {unitRange} {requestVersion} {...cardProps} />
	{/key}
</div>
