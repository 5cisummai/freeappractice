<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import QuestionCard from '$lib/components/questions/question-card.svelte';
	import QuestionSelector from '$lib/components/questions/question-selector.svelte';
	import QuizSession from '$lib/components/practice/quiz-session.svelte';
	import FrqCard from '$lib/components/questions/frq-card.svelte';
	import type { AnswerResult, TutorMode } from '$lib/question-bank/mcq/types';
	import type { FrqAttemptView } from '$lib/question-bank/frq/types';
	import type { SharedQuizView } from '$lib/shared-practice/types';
	import { captureGenerateClicked } from '$lib/client/activation-analytics';
	import { portalToBody } from '$lib/components/questions/question-card-dom';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { cn } from '$lib/utils.js';
	import { unlimitedQuestionCardModel } from '$lib/question-bank/question-card-model';

	export type PracticeMode = 'unlimited' | 'graded';
	export type PracticeInitialState = {
		selectedClass?: string;
		selectedUnit?: string;
		unitRange?: number[];
		requestVersion?: number;
		mode?: 'mcq' | 'frq';
	};
	export type PracticeCapabilities = {
		frqCourses?: readonly string[];
		tutorMode?: TutorMode;
		showFirstUseHints?: boolean;
	};
	export type PracticeQuizConfig = {
		count?: number;
		persistHistory?: boolean;
		sharedQuiz?: SharedQuizView | null;
	};
	export type PracticeExperiment = {
		assignedVariant: 'control' | 'multi_attempt_hints';
		experimentEnabled: boolean;
	};
	export type PracticeEvent =
		| { type: 'selection-change'; selectedClass: string; selectedUnit: string }
		| { type: 'mode-change'; mode: 'mcq' | 'frq' }
		| { type: 'generate'; selectedClass: string; selectedUnit: string }
		| { type: 'answered'; result: AnswerResult }
		| { type: 'frq-graded'; attempt: FrqAttemptView };

	export type PracticeRunnerProps = {
		initial?: PracticeInitialState;
		capabilities?: PracticeCapabilities;
		quiz?: PracticeQuizConfig;
		presentation?: 'standard' | 'hero';
		experiment?: PracticeExperiment;
		onEvent?: (event: PracticeEvent) => void;
	};

	// PracticeShell remains the file name for import stability; the exported component is the
	// single runner used by public practice, the app, and shared quizzes.
	let {
		initial = {},
		capabilities = {},
		quiz = {},
		presentation = 'standard',
		experiment,
		onEvent
	}: PracticeRunnerProps = $props();

	let selectedClass = $state(untrack(() => initial.selectedClass ?? ''));
	let selectedUnit = $state(untrack(() => initial.selectedUnit ?? ''));
	let unitRange = $state<number[] | undefined>(untrack(() => initial.unitRange));
	let requestVersion = $state(untrack(() => initial.requestVersion ?? 0));
	let mode = $state<'mcq' | 'frq'>(untrack(() => initial.mode ?? 'mcq'));
	let count = $state(10);
	let quizGenerating = $state(false);
	let practiceMode = $state<PracticeMode>('unlimited');
	let quizRequestVersion = $state(0);
	let expandedSelectorOpen = $state(false);
	let isExpanded = $state(false);
	let lastInitialRequestVersion = $state(untrack(() => initial.requestVersion ?? 0));

	const sharedQuiz = $derived(quiz.sharedQuiz ?? null);
	const persistQuizHistory = $derived(quiz.persistHistory ?? true);
	const allowFrq = $derived(capabilities.frqCourses?.includes(selectedClass) ?? false);
	const tutorMode = $derived(capabilities.tutorMode ?? 'free');
	const showFirstUseHints = $derived(capabilities.showFirstUseHints ?? false);
	const modeSwitcherAlignment = $derived(presentation === 'hero' ? 'center' : 'left');

	const activeQuizMode = $derived(Boolean(sharedQuiz) || practiceMode === 'graded');
	const showUnlimitedFrq = $derived(mode === 'frq' && allowFrq);
	const showUnlimitedMcq = $derived(!showUnlimitedFrq);

	function changeMode(nextMode: 'mcq' | 'frq'): void {
		mode = nextMode;
		requestVersion = 0;
		onEvent?.({ type: 'mode-change', mode: nextMode });
	}

	function handleSelectionChange(className: string, unit: string): void {
		if (activeQuizMode) quizRequestVersion = 0;
		else requestVersion = 0;
		selectedClass = className;
		selectedUnit = unit;
		onEvent?.({ type: 'selection-change', selectedClass: className, selectedUnit: unit });
	}

	function handleGenerate(): void {
		if (selectedClass) captureGenerateClicked(selectedClass, selectedUnit);
		if (activeQuizMode) count = Math.min(50, Math.max(1, Math.floor(count || 10)));
		if (activeQuizMode) quizRequestVersion += 1;
		else requestVersion += 1;
		onEvent?.({ type: 'generate', selectedClass, selectedUnit });
	}

	$effect(() => {
		if (initial.selectedClass !== undefined && initial.selectedClass !== selectedClass) {
			selectedClass = initial.selectedClass;
		}
		if (initial.selectedUnit !== undefined && initial.selectedUnit !== selectedUnit) {
			selectedUnit = initial.selectedUnit;
		}
		if (initial.unitRange !== undefined && initial.unitRange !== unitRange) {
			unitRange = initial.unitRange;
		}
		if (initial.mode !== undefined && initial.mode !== mode) mode = initial.mode;
		const nextVersion = initial.requestVersion ?? 0;
		if (nextVersion !== lastInitialRequestVersion) {
			lastInitialRequestVersion = nextVersion;
			requestVersion = nextVersion;
		}
	});

	function toggleExpanded(): void {
		isExpanded = !isExpanded;
		expandedSelectorOpen = false;
	}

	onMount(() => {
		function handleKeydown(event: KeyboardEvent): void {
			if (event.key === 'Escape' && isExpanded) {
				isExpanded = false;
				expandedSelectorOpen = false;
			}
		}

		window.addEventListener('keydown', handleKeydown);
		return () => window.removeEventListener('keydown', handleKeydown);
	});
</script>

<div
	use:portalToBody={isExpanded}
	class={cn(
		isExpanded
			? 'fixed inset-0 z-40 flex h-dvh min-h-0 flex-col overflow-hidden bg-background/75 shadow-2xl backdrop-blur-md'
			: 'relative'
	)}
>
	<div
		class={cn(
			isExpanded
				? 'relative flex min-h-0 w-full flex-1 flex-col overflow-hidden p-4 sm:p-6'
				: 'contents'
		)}
	>
		{#snippet practiceControls()}
			{#if !sharedQuiz}
				<div class="space-y-4">
					<div class={cn(isExpanded && 'mx-auto max-w-5xl')}>
						<Tabs.Root bind:value={practiceMode} class="mb-4 w-full">
							<Tabs.List
								aria-label="Practice modes"
								class={cn(
									'h-auto w-full max-w-md gap-1',
									modeSwitcherAlignment === 'center' ? 'mx-auto justify-center' : 'justify-start'
								)}
							>
								<Tabs.Trigger value="unlimited">Unlimited practice</Tabs.Trigger>
								<Tabs.Trigger value="graded">
									<Badge
										variant="outline"
										class="border-indigo-500 bg-indigo-500/10 text-indigo-500">New</Badge
									>
									Graded quizzes
								</Tabs.Trigger>
							</Tabs.List>
						</Tabs.Root>

						<div class="flex items-center justify-between gap-3">
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
						</div>

						<QuestionSelector
							bind:selectedClass
							bind:selectedUnit
							bind:unitRange
							showFirstUseHint={showFirstUseHints}
							quizMode={activeQuizMode}
							bind:count
							generateDisabled={activeQuizMode && quizGenerating}
							generateLabel={activeQuizMode ? 'Generate Quiz' : undefined}
							onSelectionChange={handleSelectionChange}
							onGenerate={handleGenerate}
						/>
					</div>
				</div>
			{/if}
		{/snippet}

		{#if !isExpanded && !sharedQuiz}
			<div id="practice-shell-controls" class="mx-auto mb-8 max-w-5xl">
				{@render practiceControls()}
			</div>
		{/if}

		<div
			class={cn(
				isExpanded ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'mx-auto min-h-40 max-w-6xl'
			)}
		>
			{#if showUnlimitedFrq}
				<div
					class={activeQuizMode
						? 'hidden'
						: isExpanded
							? 'flex h-full min-h-0 flex-1 flex-col'
							: undefined}
					aria-hidden={activeQuizMode}
				>
					<FrqCard
						{selectedClass}
						{selectedUnit}
						{unitRange}
						{requestVersion}
						showFirstUseHint={showFirstUseHints}
						{tutorMode}
						onGraded={(attempt) => onEvent?.({ type: 'frq-graded', attempt })}
					/>
				</div>
			{/if}
			<div class={activeQuizMode ? 'contents' : 'hidden'} aria-hidden={!activeQuizMode}>
				<QuizSession
					{selectedClass}
					{selectedUnit}
					{unitRange}
					{count}
					requestVersion={sharedQuiz ? requestVersion : quizRequestVersion}
					enabled={activeQuizMode}
					expanded={isExpanded}
					onExpand={toggleExpanded}
					bind:controlsOpen={expandedSelectorOpen}
					{practiceControls}
					persistHistory={persistQuizHistory}
					showCoachReview={tutorMode !== 'hidden'}
					initialQuestions={sharedQuiz?.questions}
					sharedSlug={sharedQuiz?.slug}
					bind:isGenerating={quizGenerating}
				/>
			</div>
			{#if showUnlimitedMcq}
				<div
					class={activeQuizMode
						? 'hidden'
						: isExpanded
							? 'flex h-full min-h-0 flex-1 flex-col'
							: undefined}
					aria-hidden={activeQuizMode}
				>
					{#key `${mode}:${selectedClass}:${selectedUnit}:${unitRange?.join(',') ?? ''}`}
						<QuestionCard
							model={unlimitedQuestionCardModel({
								selectedClass,
								selectedUnit,
								unitRange,
								requestVersion,
								experiment
							})}
							expanded={isExpanded}
							onExpand={toggleExpanded}
							bind:controlsOpen={expandedSelectorOpen}
							{practiceControls}
							showFirstUseHint={showFirstUseHints}
							{tutorMode}
							onAnswered={(result) => onEvent?.({ type: 'answered', result })}
						/>
					{/key}
				</div>
			{/if}
		</div>
	</div>
</div>
