<script lang="ts">
	import PracticeShell, { type PracticeMode } from '$lib/components/practice/practice-shell.svelte';
	import type { AnswerResult, QuestionCardProps } from '$lib/questions/types';
	import type { FrqAttemptView } from '$lib/frq/types';
	import type { SharedQuizView } from '$lib/shared-practice/types';
	import { cn } from '$lib/utils.js';

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
		sharedQuiz?: SharedQuizView | null;
		isPersonalizedTutor?: boolean;
		generateLabel?: string;
		onGenerate?: () => void;
		onSelectionChange?: (selectedClass: string, selectedUnit: string) => void;
		onModeChange?: (mode: 'mcq' | 'frq') => void;
		onAnswered?: (result: AnswerResult) => void;
		onFrqGraded?: (attempt: FrqAttemptView) => void;
		onHero?: boolean;
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
		sharedQuiz = null,
		isPersonalizedTutor = false,
		generateLabel,
		onGenerate,
		onSelectionChange,
		onModeChange,
		onAnswered,
		onFrqGraded,
		onHero = false,
		...cardProps
	}: QuestionShellProps = $props();

	let quizRequestVersion = $state(0);
</script>

<div
	class={cn(
		onHero &&
			'relative rounded-[1.35rem] pt-5 pb-5 shadow-lg sm:px-6 sm:pt-9 sm:pb-6 lg:px-8 lg:pt-10 lg:pb-7'
	)}
>
	{#if onHero}
		<div
			class="pointer-events-none absolute inset-0 rounded-[1.35rem] border border-white/55 bg-card/58 ring-1 ring-white/35 backdrop-blur-sm dark:border-white/12 dark:bg-card/48 dark:ring-white/10"
			aria-hidden="true"
		></div>
		<div class="absolute top-3.5 left-3.5 z-10 hidden items-center gap-2 sm:flex" aria-hidden="true">
			<span class="size-3 rounded-full bg-[#ff5f57]"></span>
			<span class="size-3 rounded-full bg-[#febc2e]"></span>
			<span class="size-3 rounded-full bg-[#28c840]"></span>
		</div>
	{/if}

	<div class={cn('relative', onHero && 'px-4 sm:px-0')}>
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
			{sharedQuiz}
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
	</div>
</div>
