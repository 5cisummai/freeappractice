<script lang="ts">
	import PracticeShell, { type PracticeMode } from '$lib/components/practice/practice-shell.svelte';
	import type { AnswerResult, QuestionCardProps } from '$lib/questions/types';
	import type { FrqAttemptView } from '$lib/frq/types';

	type QuestionShellProps = {
		selectedClass?: string;
		selectedUnit?: string;
		unitRange?: number[];
		requestVersion?: number;
		count?: number;
		quizGenerating?: boolean;
		persistQuizHistory?: boolean;
		alignment?: 'center' | 'left';
		practiceMode?: PracticeMode;
		allowFrq?: boolean;
		showFirstUseHints?: boolean;
		mode?: 'mcq' | 'frq';
		isPersonalizedTutor?: boolean;
		generateLabel?: string;
		onGenerate?: () => void;
		onSelectionChange?: (selectedClass: string, selectedUnit: string) => void;
		onModeChange?: (mode: 'mcq' | 'frq') => void;
		onAnswered?: (result: AnswerResult) => void;
		onFrqGraded?: (attempt: FrqAttemptView) => void;
	} & Omit<
		QuestionCardProps,
		| 'selectedClass'
		| 'selectedUnit'
		| 'requestVersion'
		| 'expanded'
		| 'onExpand'
		| 'controlsOpen'
		| 'practiceControls'
		| 'quizNavigation'
		| 'onAnswered'
	>;

	let {
		selectedClass = $bindable(''),
		selectedUnit = $bindable(''),
		unitRange = $bindable<number[] | undefined>(undefined),
		requestVersion = $bindable(0),
		count = $bindable(10),
		quizGenerating = $bindable(false),
		persistQuizHistory = true,
		alignment = 'center',
		practiceMode = $bindable<PracticeMode>('unlimited'),
		allowFrq = false,
		showFirstUseHints = false,
		mode = $bindable<'mcq' | 'frq'>('mcq'),
		isPersonalizedTutor = false,
		generateLabel,
		onGenerate,
		onSelectionChange,
		onModeChange,
		onAnswered,
		onFrqGraded,
		...cardProps
	}: QuestionShellProps = $props();

	let quizRequestVersion = $state(0);
</script>

<PracticeShell
	bind:selectedClass
	bind:selectedUnit
	bind:unitRange
	bind:requestVersion
	bind:count
	bind:quizGenerating
	bind:practiceMode
	bind:quizRequestVersion
	{persistQuizHistory}
	showModeSwitcher
	modeSwitcherAlignment={alignment}
	{allowFrq}
	{showFirstUseHints}
	bind:mode
	{isPersonalizedTutor}
	{generateLabel}
	{onGenerate}
	{onSelectionChange}
	{onModeChange}
	{onAnswered}
	{onFrqGraded}
	{...cardProps}
/>
