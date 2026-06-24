<script lang="ts">
	import QuestionCard from '$lib/components/question-card.svelte';
	import QuestionSelector from '$lib/components/question-selector.svelte';
	import type { QuestionCardProps } from '$lib/types/question';

	type QuestionShellProps = {
		selectedClass?: string;
		selectedUnit?: string;
		customTopic?: string;
		requestVersion?: number;
		isLoading?: boolean;
		generateLabel?: string;
		onGenerate?: () => void;
		onSelectionChange?: (selectedClass: string, selectedUnit: string) => void;
	} & Omit<QuestionCardProps, 'selectedClass' | 'selectedUnit' | 'customTopic' | 'requestVersion'>;

	let {
		selectedClass = $bindable(''),
		selectedUnit = $bindable(''),
		customTopic = $bindable(''),
		requestVersion = $bindable(0),
		isLoading = false,
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
		requestVersion += 1;
		onGenerate?.();
	}
</script>

<div class="mx-auto mb-8 max-w-5xl">
	<QuestionSelector
		bind:selectedClass
		bind:selectedUnit
		bind:customTopic
		{isLoading}
		{generateLabel}
		onSelectionChange={handleSelectionChange}
		onGenerate={handleGenerate}
	/>
</div>

<div class="mx-auto min-h-40 max-w-6xl">
	{#key `${selectedClass}:${selectedUnit}:${requestVersion}`}
		<QuestionCard {selectedClass} {selectedUnit} {customTopic} {requestVersion} {...cardProps} />
	{/key}
</div>
