<script lang="ts">
	import PracticeShell from '$lib/components/practice/practice-shell.svelte';
	import type { QuestionCardProps } from '$lib/questions/types';

	/** Public MCQ-only practice chrome — thin wrapper over PracticeShell. */
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
		...rest
	}: QuestionShellProps = $props();
</script>

<PracticeShell
	bind:selectedClass
	bind:selectedUnit
	bind:unitRange
	bind:requestVersion
	allowFrq={false}
	{...rest}
/>
