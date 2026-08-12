<script lang="ts">
	import { onMount } from 'svelte';
	import QuestionCard from '$lib/components/questions/question-card.svelte';
	import QuestionSelector from '$lib/components/questions/question-selector.svelte';
	import QuizSession from '$lib/components/practice/quiz-session.svelte';
	import FrqCard from '$lib/components/questions/frq-card.svelte';
	import type { AnswerResult, QuestionCardProps } from '$lib/questions/types';
	import type { FrqAttemptView } from '$lib/frq/types';
	import type { SharedQuizView } from '$lib/shared-practice/types';
	import { captureGenerateClicked } from '$lib/client/activation-analytics';
	import { portalToBody } from '$lib/components/questions/question-card-dom';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { cn } from '$lib/utils.js';

	export type PracticeMode = 'unlimited' | 'graded';

	export type PracticeShellProps = {
		selectedClass?: string;
		selectedUnit?: string;
		unitRange?: number[];
		requestVersion?: number;
		quizMode?: boolean;
		count?: number;
		quizGenerating?: boolean;
		persistQuizHistory?: boolean;
		showModeSwitcher?: boolean;
		modeSwitcherAlignment?: 'center' | 'left';
		practiceMode?: PracticeMode;
		quizRequestVersion?: number;
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
	} & Omit<
		QuestionCardProps,
		| 'selectedClass'
		| 'selectedUnit'
		| 'requestVersion'
		| 'onAnswered'
		| 'expanded'
		| 'onExpand'
		| 'controlsOpen'
		| 'practiceControls'
		| 'quizNavigation'
	>;

	let {
		selectedClass = $bindable(''),
		selectedUnit = $bindable(''),
		unitRange = $bindable<number[] | undefined>(undefined),
		requestVersion = $bindable(0),
		quizMode = false,
		count = $bindable(10),
		quizGenerating = $bindable(false),
		persistQuizHistory = true,
		showModeSwitcher = false,
		modeSwitcherAlignment = 'center',
		practiceMode = $bindable<PracticeMode>('unlimited'),
		quizRequestVersion = $bindable(0),
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
		...cardProps
	}: PracticeShellProps = $props();

	let isExpanded = $state(false);
	let expandedSelectorOpen = $state(false);
	const activeQuizMode = $derived(
		Boolean(sharedQuiz) || (showModeSwitcher ? practiceMode === 'graded' : quizMode)
	);
	const activeRequestVersion = $derived(
		showModeSwitcher && !sharedQuiz && activeQuizMode ? quizRequestVersion : requestVersion
	);

	function changeMode(nextMode: 'mcq' | 'frq'): void {
		mode = nextMode;
		requestVersion = 0;
		onModeChange?.(nextMode);
	}

	function handleSelectionChange(className: string, unit: string): void {
		if (showModeSwitcher && activeQuizMode) quizRequestVersion = 0;
		else requestVersion = 0;
		onSelectionChange?.(className, unit);
	}

	function handleGenerate(): void {
		if (selectedClass) captureGenerateClicked(selectedClass, selectedUnit);
		if (activeQuizMode) count = Math.min(50, Math.max(1, Math.floor(count || 10)));
		if (showModeSwitcher && activeQuizMode) quizRequestVersion += 1;
		else requestVersion += 1;
		onGenerate?.();
	}

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
			? 'fixed inset-0 z-40 flex min-h-0 flex-col overflow-hidden bg-background/75 shadow-2xl backdrop-blur-md'
			: 'relative'
	)}
>
	<div
		class={cn(
			isExpanded
				? 'relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-card/90 backdrop-blur-sm'
				: 'contents'
		)}
	>
		{#snippet practiceControls()}
			{#if !sharedQuiz}
				<div class="space-y-4">
					<div class={cn(isExpanded && 'mx-auto max-w-5xl')}>
						{#if showModeSwitcher}
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
						{/if}

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
							generateLabel={activeQuizMode ? 'Generate Quiz' : generateLabel}
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
			{#if mode === 'frq' && allowFrq && !activeQuizMode}
				<FrqCard
					{selectedClass}
					{selectedUnit}
					{unitRange}
					requestVersion={activeRequestVersion}
					showFirstUseHint={showFirstUseHints}
					{isPersonalizedTutor}
					onGraded={onFrqGraded}
				/>
			{:else}
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
						initialQuestions={sharedQuiz?.questions}
						sharedSlug={sharedQuiz?.slug}
						bind:isGenerating={quizGenerating}
					/>
				</div>
				{#if !activeQuizMode}
					{#key `${mode}:${selectedClass}:${selectedUnit}:${unitRange?.join(',') ?? ''}`}
						<QuestionCard
							{selectedClass}
							{selectedUnit}
							{unitRange}
							requestVersion={activeRequestVersion}
							expanded={isExpanded}
							onExpand={toggleExpanded}
							bind:controlsOpen={expandedSelectorOpen}
							{practiceControls}
							showFirstUseHint={showFirstUseHints}
							{isPersonalizedTutor}
							{onAnswered}
							{...cardProps}
						/>
					{/key}
				{/if}
			{/if}
		</div>
	</div>
</div>
