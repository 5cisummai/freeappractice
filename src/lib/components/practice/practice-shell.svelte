<script lang="ts">
	import { untrack } from 'svelte';
	import QuestionCard from '$lib/components/questions/question-card.svelte';
	import QuestionSelector from '$lib/components/questions/question-selector.svelte';
	import FrqCard from '$lib/components/questions/frq-card.svelte';
	import QuizSession from '$lib/components/practice/quiz-session.svelte';
	import EmptyState from '$lib/components/app/empty-state.svelte';
	import type { AnswerResult, TutorMode } from '$lib/question-bank/mcq/types';
	import type { FrqAttemptView } from '$lib/question-bank/frq/types';
	import type { SharedQuizView } from '$lib/shared-practice/types';
	import { captureGenerateClicked } from '$lib/client/activation-analytics';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { cn } from '$lib/utils.js';
	import { unlimitedQuestionCardModel } from '$lib/question-bank/question-card-model';

	export type PracticeMode = 'unlimited' | 'graded';
	export type PracticeInitialState = {
		selectedClass?: string;
		selectedUnit?: string;
		unitRange?: number[];
		requestVersion?: number;
		presetQuestionId?: string;
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
	export type PracticeEvent =
		| { type: 'selection-change'; selectedClass: string; selectedUnit: string }
		| { type: 'mode-change'; mode: 'mcq' | 'frq' }
		| { type: 'generate'; selectedClass: string; selectedUnit: string }
		| { type: 'answered'; result: AnswerResult }
		| { type: 'frq-graded'; attempt: FrqAttemptView }
		| { type: 'quiz-exit' };

	export type PracticeRunnerProps = {
		initial?: PracticeInitialState;
		capabilities?: PracticeCapabilities;
		quiz?: PracticeQuizConfig;
		presentation?: 'standard' | 'hero';
		onEvent?: (event: PracticeEvent) => void;
	};

	let {
		initial = {},
		capabilities = {},
		quiz = {},
		presentation = 'standard',
		onEvent
	}: PracticeRunnerProps = $props();

	let selectedClass = $state(untrack(() => initial.selectedClass ?? ''));
	let selectedUnit = $state(untrack(() => initial.selectedUnit ?? ''));
	let unitRange = $state<number[] | undefined>(untrack(() => initial.unitRange));
	let requestVersion = $state(untrack(() => initial.requestVersion ?? 0));
	let quizRequestVersion = $state(0);
	let quizGenerating = $state(false);
	let presetQuestionId = $state(untrack(() => initial.presetQuestionId ?? ''));
	let mode = $state<'mcq' | 'frq'>(untrack(() => initial.mode ?? 'mcq'));
	let count = $state(untrack(() => Math.min(50, Math.max(1, quiz.count ?? 10))));
	let practiceMode = $state<PracticeMode>('unlimited');
	let lastInitialRequestVersion = $state(untrack(() => initial.requestVersion ?? 0));
	let expandedSelectorOpen = $state(false);
	let cardExpanded = $state(false);

	const sharedQuiz = $derived(quiz.sharedQuiz ?? null);
	const persistQuizHistory = $derived(quiz.persistHistory ?? true);
	const allowFrq = $derived(capabilities.frqCourses?.includes(selectedClass) ?? false);
	const tutorMode = $derived(capabilities.tutorMode ?? 'free');
	const showFirstUseHints = $derived(capabilities.showFirstUseHints ?? false);
	const modeSwitcherAlignment = $derived(presentation === 'hero' ? 'center' : 'left');

	const activeQuizMode = $derived(Boolean(sharedQuiz) || practiceMode === 'graded');
	const showUnlimitedFrq = $derived(!activeQuizMode && mode === 'frq' && allowFrq);
	const showUnlimitedMcq = $derived(!activeQuizMode && !showUnlimitedFrq);

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

	function handleQuizExit(): void {
		if (!sharedQuiz) quizRequestVersion = 0;
		onEvent?.({ type: 'quiz-exit' });
	}

	function handleGenerate(): void {
		if (selectedClass) captureGenerateClicked(selectedClass, selectedUnit);
		if (activeQuizMode) {
			count = Math.min(50, Math.max(1, Math.floor(count || 10)));
			quizRequestVersion += 1;
		} else {
			requestVersion += 1;
		}
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
		if (initial.presetQuestionId !== undefined && initial.presetQuestionId !== presetQuestionId) {
			presetQuestionId = initial.presetQuestionId;
		}
		const nextVersion = initial.requestVersion ?? 0;
		if (nextVersion !== lastInitialRequestVersion) {
			lastInitialRequestVersion = nextVersion;
			requestVersion = nextVersion;
		}
	});

	$effect(() => {
		if (!cardExpanded) expandedSelectorOpen = false;
	});

	$effect(() => {
		if (activeQuizMode) cardExpanded = false;
	});

	$effect(() => {
		if (sharedQuiz) practiceMode = 'graded';
	});
</script>

{#snippet practiceControls()}
	{#if !sharedQuiz}
		<div class="space-y-4">
			<div class="mx-auto max-w-5xl">
				<Tabs.Root bind:value={practiceMode} class="mb-4 w-full">
					<Tabs.List
						aria-label="Practice modes"
						class={cn(
							'h-auto w-full max-w-md gap-1',
							modeSwitcherAlignment === 'center' ? 'mx-auto justify-center' : 'justify-start'
						)}
					>
						<Tabs.Trigger value="unlimited">Unlimited practice</Tabs.Trigger>
						<Tabs.Trigger value="graded">Graded quizzes</Tabs.Trigger>
					</Tabs.List>
				</Tabs.Root>

				<div class="flex items-center justify-between gap-3">
					{#if allowFrq && !activeQuizMode}
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
					generateLabel={activeQuizMode ? 'Generate Quiz' : undefined}
					generateDisabled={activeQuizMode && quizGenerating}
					onSelectionChange={handleSelectionChange}
					onGenerate={handleGenerate}
				/>
			</div>
		</div>
	{/if}
{/snippet}

<div class="relative">
	{#if !cardExpanded && !sharedQuiz}
		<div
			id="practice-shell-controls"
			class={cn('mx-auto mb-8 max-w-5xl', presentation === 'hero' && 'max-sm:px-4')}
		>
			{@render practiceControls()}
		</div>
	{/if}

	<div class="mx-auto min-h-40 max-w-6xl">
		{#if showUnlimitedFrq}
			<div>
				<FrqCard
					{selectedClass}
					{selectedUnit}
					{unitRange}
					{requestVersion}
					{presetQuestionId}
					showFirstUseHint={showFirstUseHints}
					{tutorMode}
					onGraded={(attempt) => onEvent?.({ type: 'frq-graded', attempt })}
				/>
			</div>
		{/if}

		{#if activeQuizMode}
			{#key `quiz:${selectedClass}:${selectedUnit}:${unitRange?.join(',') ?? ''}:${sharedQuiz?.slug ?? ''}`}
				<QuizSession
					{selectedClass}
					{selectedUnit}
					{unitRange}
					{count}
					requestVersion={sharedQuiz ? requestVersion : quizRequestVersion}
					bind:isGenerating={quizGenerating}
					persistHistory={persistQuizHistory}
					showCoachReview={tutorMode !== 'hidden'}
					initialQuestions={sharedQuiz?.questions ?? null}
					sharedSlug={sharedQuiz?.slug ?? ''}
					title={sharedQuiz?.title}
					onExit={handleQuizExit}
				/>
			{/key}
		{:else if showUnlimitedMcq}
			{#key `${mode}:${selectedClass}:${selectedUnit}:${unitRange?.join(',') ?? ''}`}
				<QuestionCard
					model={unlimitedQuestionCardModel({
						selectedClass,
						selectedUnit,
						unitRange,
						requestVersion,
						presetQuestionId: presetQuestionId || undefined
					})}
					bind:expanded={cardExpanded}
					bind:controlsOpen={expandedSelectorOpen}
					{practiceControls}
					showFirstUseHint={showFirstUseHints}
					{tutorMode}
					onAnswered={(result) => onEvent?.({ type: 'answered', result })}
				/>
			{/key}
		{:else}
			<EmptyState
				title="Ready When You Are"
				description="Select a course and unit, then generate a question."
				imageUrl="/illustrations/lightbulb.png"
			/>
		{/if}
	</div>
</div>
