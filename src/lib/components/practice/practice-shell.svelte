<script lang="ts">
	import { untrack } from 'svelte';
	import QuestionCard from '$lib/components/questions/question-card.svelte';
	import QuestionSelector from '$lib/components/questions/question-selector.svelte';
	import type { AnswerResult, TutorMode } from '$lib/question-bank/mcq/types';
	import type { FrqAttemptView } from '$lib/question-bank/frq/types';
	import type { SharedQuizView } from '$lib/shared-practice/types';
	import { captureGenerateClicked } from '$lib/client/activation-analytics';
	import { createLazyComponentLoader } from '$lib/client/lazy-component.js';
	import LazyComponent from '$lib/components/app/lazy-component.svelte';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { Badge } from '$lib/components/ui/badge';
	import { cn } from '$lib/utils.js';
	import { unlimitedQuestionCardModel } from '$lib/question-bank/question-card-model';

	export type PracticeMode = 'unlimited' | 'graded' | 'frq';
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

	const startingSelection = untrack(() => {
		const initialFrqCourses = capabilities.frqCourses ?? [];
		const startFrq = !quiz.sharedQuiz && initial.mode === 'frq' && initialFrqCourses.length > 0;
		let nextClass = initial.selectedClass ?? '';
		let nextUnit = initial.selectedUnit ?? '';
		let nextRange = initial.unitRange;
		if (startFrq && nextClass && !initialFrqCourses.includes(nextClass)) {
			nextClass = '';
			nextUnit = '';
			nextRange = undefined;
		}
		const nextPracticeMode: PracticeMode = quiz.sharedQuiz
			? 'graded'
			: startFrq
				? 'frq'
				: 'unlimited';
		return {
			selectedClass: nextClass,
			selectedUnit: nextUnit,
			unitRange: nextRange,
			practiceMode: nextPracticeMode
		};
	});

	let selectedClass = $state(startingSelection.selectedClass);
	let selectedUnit = $state(startingSelection.selectedUnit);
	let selectedFormat = $state('');
	let unitRange = $state<number[] | undefined>(startingSelection.unitRange);
	let requestVersion = $state(untrack(() => initial.requestVersion ?? 0));
	let quizRequestVersion = $state(0);
	let quizGenerating = $state(false);
	let presetQuestionId = $state(untrack(() => initial.presetQuestionId ?? ''));
	let count = $state(untrack(() => Math.min(50, Math.max(1, quiz.count ?? 10))));
	let practiceMode = $state<PracticeMode>(startingSelection.practiceMode);
	let expandedSelectorOpen = $state(false);
	let cardExpanded = $state(false);
	const loadQuizSession = createLazyComponentLoader(
		() => import('$lib/components/practice/quiz-session.svelte')
	);
	const loadFrqSession = createLazyComponentLoader(
		() => import('$lib/components/practice/frq-session.svelte')
	);

	const sharedQuiz = $derived(quiz.sharedQuiz ?? null);
	const persistQuizHistory = $derived(quiz.persistHistory ?? true);
	const frqCourses = $derived(capabilities.frqCourses ?? []);
	const frqTabEnabled = $derived(frqCourses.length > 0);
	const tutorMode = $derived(capabilities.tutorMode ?? 'free');
	const showFirstUseHints = $derived(capabilities.showFirstUseHints ?? false);
	const mode = $derived<'mcq' | 'frq'>(practiceMode === 'frq' ? 'frq' : 'mcq');
	const modeSwitcherAlignment = $derived(presentation === 'hero' ? 'center' : 'left');
	const tabsListClass = $derived(
		cn(
			'h-auto w-full gap-1',
			frqTabEnabled ? 'max-w-xl' : 'max-w-md',
			modeSwitcherAlignment === 'center' ? 'mx-auto justify-center' : 'justify-start'
		)
	);

	const activeQuizMode = $derived(Boolean(sharedQuiz) || practiceMode === 'graded');
	const showUnlimitedMcq = $derived(!activeQuizMode && practiceMode === 'unlimited');

	function parsePracticeMode(next: string | undefined): PracticeMode {
		switch (next) {
			case 'graded':
				return 'graded';
			case 'frq':
				return frqTabEnabled ? 'frq' : 'unlimited';
			case 'unlimited':
				return 'unlimited';
			default:
				return 'unlimited';
		}
	}

	function setPracticeMode(next: string | undefined): void {
		const previous = practiceMode;
		const nextMode = parsePracticeMode(next);
		practiceMode = nextMode;

		switch (nextMode) {
			case 'unlimited':
				break;
			case 'graded':
			case 'frq':
				cardExpanded = false;
				expandedSelectorOpen = false;
				break;
			default: {
				const _exhaustive: never = nextMode;
				return _exhaustive;
			}
		}

		if (nextMode === 'frq') unitRange = undefined;
		if (nextMode === 'frq' && selectedClass && !frqCourses.includes(selectedClass)) {
			selectedClass = '';
			selectedUnit = '';
			selectedFormat = '';
			unitRange = undefined;
			onEvent?.({ type: 'selection-change', selectedClass: '', selectedUnit: '' });
		}

		const previousQuestionMode = previous === 'frq' ? 'frq' : 'mcq';
		const nextQuestionMode = nextMode === 'frq' ? 'frq' : 'mcq';
		if (nextQuestionMode !== previousQuestionMode) {
			requestVersion = 0;
			onEvent?.({ type: 'mode-change', mode: nextQuestionMode });
		}
	}

	function setCardExpanded(next: boolean): void {
		cardExpanded = next;
		if (!next) expandedSelectorOpen = false;
	}

	function handleSelectionChange(className: string, unit: string): void {
		if (activeQuizMode) quizRequestVersion = 0;
		else requestVersion = 0;
		presetQuestionId = '';
		selectedClass = className;
		selectedUnit = unit;
		onEvent?.({ type: 'selection-change', selectedClass: className, selectedUnit: unit });
	}

	function handleQuizExit(): void {
		if (!sharedQuiz) quizRequestVersion = 0;
		onEvent?.({ type: 'quiz-exit' });
	}

	function handleFrqExit(): void {
		requestVersion = 0;
	}

	function handleFrqGraded(attempt: FrqAttemptView): void {
		onEvent?.({ type: 'frq-graded', attempt });
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
</script>

{#snippet practiceControls()}
	{#if !sharedQuiz}
		<div class="space-y-4">
			<div class="mx-auto max-w-5xl">
				<Tabs.Root
					bind:value={() => practiceMode, (value) => setPracticeMode(value)}
					class="mb-4 w-full"
				>
					<Tabs.List aria-label="Practice modes" class={tabsListClass}>
						<Tabs.Trigger value="unlimited">Unlimited MCQ</Tabs.Trigger>
						<Tabs.Trigger value="graded">Graded Quizzes</Tabs.Trigger>
						{#if frqTabEnabled}
							<Tabs.Trigger value="frq">
								Free Response
								<Badge
									variant="secondary"
									class="h-5 bg-primary/10 px-1.5 text-[10px] text-primary"
								>New</Badge
								>
							</Tabs.Trigger>
						{/if}
					</Tabs.List>
				</Tabs.Root>

				<QuestionSelector
					bind:selectedClass
					bind:selectedUnit
					bind:selectedFormat
					bind:unitRange
					{mode}
					allowedClassNames={practiceMode === 'frq' ? frqCourses : undefined}
					showFirstUseHint={showFirstUseHints}
					quizMode={activeQuizMode}
					bind:count
					generateLabel={activeQuizMode
						? 'Start quiz'
						: requestVersion > 0
							? 'Next question'
							: 'Practice'}
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
		{#if activeQuizMode}
			{#key `quiz:${selectedClass}:${selectedUnit}:${unitRange?.join(',') ?? ''}:${sharedQuiz?.slug ?? ''}`}
				<LazyComponent
					load={loadQuizSession}
					pending="Loading quiz…"
					error="Quiz could not be loaded."
				>
					{#snippet children(QuizSession)}
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
					{/snippet}
				</LazyComponent>
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
					bind:expanded={() => cardExpanded, (value) => setCardExpanded(value)}
					bind:controlsOpen={expandedSelectorOpen}
					{practiceControls}
					showFirstUseHint={showFirstUseHints}
					{tutorMode}
					onAnswered={(result) => onEvent?.({ type: 'answered', result })}
				/>
			{/key}
		{:else if practiceMode === 'frq'}
			{#key `frq:${selectedClass}:${selectedUnit}:${selectedFormat}`}
				<LazyComponent
					load={loadFrqSession}
					pending="Loading free response…"
					error="Free response could not be loaded."
				>
					{#snippet children(FrqSession)}
						<FrqSession
							{selectedClass}
							{selectedUnit}
							{selectedFormat}
							{requestVersion}
							{presetQuestionId}
							{tutorMode}
							showFirstUseHint={showFirstUseHints}
							onGraded={handleFrqGraded}
							onExit={handleFrqExit}
						/>
					{/snippet}
				</LazyComponent>
			{/key}
		{/if}
	</div>
</div>
