<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { fade } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import BugReportDialog from '$lib/components/questions/bug-report-dialog.svelte';
	import McqAnswerChoices from '$lib/components/questions/mcq-answer-choices.svelte';
	import QuestionCardSkeleton from '$lib/components/questions/question-card-skeleton.svelte';
	import EmptyState from '$lib/components/app/empty-state.svelte';
	import RichText from '$lib/components/content/rich-text.svelte';
	import * as Resizable from '$lib/components/ui/resizable/index.js';
	import { cn } from '$lib/utils.js';
	import { capturePostHogEvent } from '$lib/client/posthog-analytics';
	import { measureLongQuestion } from '$lib/components/questions/question-card-dom';
	import { createQuestionCardSession } from '$lib/components/questions/question-card-session.svelte.js';
	import type { BugReportContext, QuestionCardProps } from '$lib/question-bank/mcq/types';
	const lightbulbImage = '/illustrations/lightbulb.png';
	import Maximize2Icon from '@lucide/svelte/icons/maximize-2';
	import Minimize2Icon from '@lucide/svelte/icons/minimize-2';
	import SlidersHorizontalIcon from '@lucide/svelte/icons/sliders-horizontal';
	import TutorWidget from '$lib/components/questions/tutor-widget.svelte';
	import SuperTutorWidget from '$lib/components/questions/super-tutor-widget.svelte';
	import ExamfigDiagram from '$lib/components/questions/examfig-diagram.svelte';

	let {
		model,
		class: className,
		expanded = false,
		onExpand,
		controlsOpen = $bindable(false),
		practiceControls,
		headerActions,
		quizNavigation,
		nextDisabled = false,
		onQuizNext,
		selectedOption = $bindable<string | null>(null),
		autoDetectLongQuestion = true,
		longQuestionThresholdChars = 450,
		autoShowExplanation = true,
		checkLabel = 'Check Answer',
		nextLabel = 'Next Question',
		showExplanationLabel = 'Show Explanation',
		showUtilityActions = true,
		showFirstUseHint = false,
		isPersonalizedTutor = false,
		tutorMode = isPersonalizedTutor ? 'personalized' : 'free',
		skipLabel = 'Skip',
		notLearnedLabel = "I haven't learned this yet",
		reportBugLabel = 'Report a bug',
		onCheckAnswer,
		onOptionSelected,
		onSkip,
		onNotLearned,
		onReportBug,
		onAnswered
	}: QuestionCardProps = $props();

	const selectedClass = $derived(model.selectedClass);
	const selectedUnit = $derived(model.selectedUnit);
	const quizMode = $derived(model.delivery.kind === 'quiz');
	const questionNumber = $derived(
		model.delivery.kind === 'quiz' ? model.delivery.questionNumber : ''
	);
	const quizQuestion = $derived(model.delivery.kind === 'quiz' ? model.delivery.question : null);
	const quizAnswer = $derived(model.delivery.kind === 'quiz' ? model.delivery.answer : null);
	const unitRange = $derived(
		model.delivery.kind === 'unlimited' ? model.delivery.unitRange : undefined
	);
	const requestVersion = $derived(
		model.delivery.kind === 'unlimited' ? model.delivery.requestVersion : 0
	);
	const presetQuestionId = $derived(
		model.delivery.kind === 'unlimited' ? model.delivery.presetQuestionId : undefined
	);
	const isLandingPage = $derived(page.route.id === '/');

	let promptElement: HTMLDivElement | null = null;
	let isLongQuestion = $state(false);
	let mounted = $state(!browser);
	let bugReportOpen = $state(false);
	let bugReportContext = $state<BugReportContext | null>(null);
	let isMobileViewport = $state(false);
	let controlsTriggerRef = $state<HTMLButtonElement | null>(null);

	const session = createQuestionCardSession({
		getSelectedClass: () => selectedClass,
		getSelectedUnit: () => selectedUnit,
		getUnitRange: () => unitRange,
		getRequestVersion: () => requestVersion,
		getPresetQuestionId: () => presetQuestionId,
		getQuestionNumber: () => questionNumber,
		getQuizMode: () => quizMode,
		getQuizQuestion: () => quizQuestion,
		getQuizAnswer: () => quizAnswer,
		getAutoShowExplanation: () => autoShowExplanation,
		getSelectedOption: () => selectedOption,
		getMounted: () => mounted,
		setSelectedOption: (value) => {
			selectedOption = value;
		},
		onCheckAnswer: (value) => onCheckAnswer?.(value),
		onOptionSelected: (value) => onOptionSelected?.(value),
		onSkip: () => onSkip?.(),
		onNotLearned: () => onNotLearned?.(),
		onAnswered: (result) => onAnswered?.(result),
		onQuizNext: () => onQuizNext?.(),
		practiceExperiment: untrack(() =>
			model.delivery.kind === 'unlimited' ? model.delivery.experiment : undefined
		)
	});

	const tutorUnitLabel = $derived(selectedUnit);
	const effectiveTwoColumn = $derived(
		!isMobileViewport &&
			(session.currentQuestion?.hasStimulus || (autoDetectLongQuestion && isLongQuestion))
	);
	const expandedTwoColumn = $derived(!isMobileViewport && (expanded || effectiveTwoColumn));

	function detectLongQuestionLayout(node: HTMLDivElement | null = promptElement): void {
		isLongQuestion = measureLongQuestion({
			prompt: session.currentQuestion?.prompt ?? '',
			node,
			longQuestionThresholdChars
		});
	}

	function observePromptLayout(node: HTMLDivElement, promptText: string) {
		void promptText;
		promptElement = node;

		const measure = () => {
			detectLongQuestionLayout(node);
		};

		let frame = requestAnimationFrame(measure);
		const resizeObserver = new ResizeObserver(measure);
		resizeObserver.observe(node);

		return {
			update() {
				cancelAnimationFrame(frame);
				frame = requestAnimationFrame(measure);
			},
			destroy() {
				resizeObserver.disconnect();
				cancelAnimationFrame(frame);
				if (promptElement === node) {
					promptElement = null;
				}
			}
		};
	}

	function handleReportBugAction(): void {
		const ctx: BugReportContext = {
			questionId: session.currentQuestion?.questionId,
			questionNumber: session.effectiveQuestionNumber,
			selectedClass,
			selectedUnit,
			prompt: session.currentQuestion?.prompt,
			correctAnswer: session.currentQuestion?.correctAnswer,
			hasStimulus: Boolean(session.currentQuestion?.hasStimulus)
		};
		onReportBug?.(ctx);
		bugReportContext = ctx;
		bugReportOpen = true;
	}

	const showQuestionSkeleton = $derived(
		!session.currentQuestion &&
			(session.isLoading ||
				!mounted ||
				(requestVersion > 0 && !session.showWarmingState && !session.showErrorState))
	);

	onMount(() => {
		mounted = true;

		const onResize = () => {
			isMobileViewport = window.innerWidth < 768;
			detectLongQuestionLayout();
		};
		window.addEventListener('resize', onResize);
		onResize();

		void session.init();

		return () => {
			session.destroy();
			window.removeEventListener('resize', onResize);
		};
	});

	// Generate increments requestVersion without remounting — load here instead of via {#key}.
	let lastLoadedRequestVersion = 0;
	$effect(() => {
		const version = requestVersion;
		if (!mounted || version === 0 || version === lastLoadedRequestVersion) return;
		lastLoadedRequestVersion = version;
		void session.loadQuestion();
	});
</script>

{#if session.showWarmingState}
	<Card.Root class={cn('relative overflow-visible bg-transparent shadow-none ring-0', className)}>
		<Card.Content
			class="relative flex min-h-40 flex-col items-center justify-center gap-3 px-6 pb-12 text-center"
		>
			<p class="text-lg font-medium text-muted-foreground sm:text-xl">Practice is warming up</p>
			<p class="max-w-sm text-sm text-muted-foreground/80">
				{session.statusMessage ||
					'This course unit is still being prepared. Your class and unit selection are unchanged — retry in a moment.'}
			</p>
			<p class="text-xs text-muted-foreground/70">
				Typical wait about {session.poolWarmingRetryAfterSeconds}s
			</p>
			<Button onclick={() => void session.retryWarmingLoad()} disabled={session.isLoading}>
				{session.isLoading ? 'Checking…' : 'Retry now'}
			</Button>
		</Card.Content>
	</Card.Root>
{:else if showQuestionSkeleton}
	<QuestionCardSkeleton class={className} />
{:else if session.showEmptyState}
	<EmptyState
		title="Ready When You Are"
		description="Select a course and unit, then generate a question."
		imageUrl={lightbulbImage}
	/>
{:else if session.showErrorState}
	<Card.Root class={cn('relative overflow-visible bg-transparent shadow-none ring-0', className)}>
		<Card.Content
			class="relative flex min-h-40 flex-col items-center justify-center gap-3 px-6 pb-12 text-center"
		>
			<p class="text-lg font-medium text-muted-foreground sm:text-xl">
				We couldn’t load this question
			</p>
			<p class="max-w-sm text-sm text-muted-foreground/80">
				Sorry about that — we’ve noted this so we can get it fixed. Please try again in a moment.
			</p>
			<Button onclick={() => void session.loadQuestion()} disabled={session.isLoading}
				>Try again</Button
			>
		</Card.Content>
	</Card.Root>
{:else}
	<Popover.Root bind:open={controlsOpen}>
		<div class={expanded ? 'flex min-h-0 flex-1 flex-col' : 'contents'}>
			{#snippet cardInner(expanded: boolean)}
				{#snippet mcqChoices(compact = false)}
					<McqAnswerChoices
						options={session.currentQuestion?.options ?? []}
						{selectedOption}
						hasCheckedAnswer={session.hasCheckedAnswer}
						checkedSelection={session.checkedSelection}
						correctAnswer={session.currentQuestion?.correctAnswer}
						onSelect={session.handleOptionSelect}
						showFeedback={!quizMode}
						{compact}
						lockedChoices={session.lockedChoices}
					/>
				{/snippet}

				<Card.Content class={cn('flex flex-col gap-6 pt-0 pb-0', expanded && 'min-h-0 flex-1')}>
					<div class="flex shrink-0 items-start justify-between gap-4">
						<div>
							<h2 class="mt-0.5 text-xl font-semibold">
								Question {session.effectiveQuestionNumber}
							</h2>
						</div>
						<div class="flex items-center gap-1">
							{#if headerActions}
								{@render headerActions()}
							{/if}
							{#if expanded && practiceControls}
								<Popover.Trigger bind:ref={controlsTriggerRef}>
									{#snippet child({ props })}
										<Button
											{...props}
											variant="ghost"
											size="icon"
											class={cn(
												'h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground',
												controlsOpen && 'bg-muted/60 text-foreground'
											)}
											aria-label={controlsOpen
												? 'Hide practice controls'
												: 'Open practice controls'}
											aria-expanded={controlsOpen}
											aria-controls="practice-shell-controls"
										>
											<SlidersHorizontalIcon class="h-4 w-4" />
										</Button>
									{/snippet}
								</Popover.Trigger>
							{/if}
							{#if onExpand}
								<Button
									variant="ghost"
									size="icon"
									class="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
									onclick={onExpand}
									aria-label={expanded ? 'Collapse practice' : 'Expand practice'}
								>
									{#if expanded}
										<Minimize2Icon class="h-4 w-4" />
									{:else}
										<Maximize2Icon class="h-4 w-4" />
									{/if}
								</Button>
							{/if}
						</div>
					</div>

					{#if session.currentQuestion?.diagramSpec}
						<ExamfigDiagram
							spec={session.currentQuestion.diagramSpec}
							class="[&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
						/>
					{/if}

					{#if session.currentQuestion?.hasStimulus && !isMobileViewport}
						<div
							class={cn(
								'overflow-hidden rounded-lg border border-border/70',
								expanded ? 'min-h-0 flex-1' : 'h-88'
							)}
						>
							<Resizable.PaneGroup direction="horizontal" class="h-full">
								<Resizable.Pane defaultSize={54} minSize={30} class="min-w-0">
									<div class="h-full space-y-3 overflow-y-auto p-4 sm:p-5">
										<p class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
											{session.currentQuestion.leftPanel?.title ?? 'Stimulus'}
										</p>
										<div class="space-y-4 font-serif text-sm leading-6 text-foreground/90">
											{#each session.currentQuestion.leftPanel?.content ?? [] as paragraph, i (`l-${i}`)}
												<RichText text={paragraph} />
											{/each}
										</div>
									</div>
								</Resizable.Pane>
								<Resizable.Handle withHandle />
								<Resizable.Pane defaultSize={46} minSize={30} class="min-w-0">
									<div
										use:observePromptLayout={session.currentQuestion?.prompt ?? ''}
										class="h-full space-y-3 overflow-y-auto p-4 sm:p-5"
									>
										<p class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
											{session.currentQuestion.rightPanel?.title ?? 'Prompt'}
										</p>
										<div class="space-y-4 font-serif text-sm leading-7 text-foreground/90">
											{#each session.currentQuestion.rightPanel?.content ?? [session.currentQuestion?.prompt] as paragraph, i (`r-${i}`)}
												<RichText text={paragraph} />
											{/each}
										</div>
									</div>
								</Resizable.Pane>
							</Resizable.PaneGroup>
						</div>
						{@render mcqChoices()}
					{:else if expandedTwoColumn}
						<div
							class={cn(
								'overflow-hidden rounded-lg border border-border/70',
								expanded ? 'min-h-0 flex-1' : 'h-100'
							)}
						>
							<Resizable.PaneGroup direction="horizontal" class="h-full">
								<Resizable.Pane defaultSize={56} minSize={35} class="min-w-0">
									<div
										use:observePromptLayout={session.currentQuestion?.prompt ?? ''}
										class="h-full overflow-y-auto p-4 sm:p-5"
									>
										<p
											class="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
										>
											Question
										</p>
										<RichText
											text={session.currentQuestion?.prompt ?? ''}
											class="font-serif text-sm leading-7 text-foreground/90"
										/>
									</div>
								</Resizable.Pane>
								<Resizable.Handle withHandle />
								<Resizable.Pane defaultSize={44} minSize={30} class="min-w-0">
									<div class="h-full overflow-y-auto p-4 sm:p-5">
										{@render mcqChoices(true)}
									</div>
								</Resizable.Pane>
							</Resizable.PaneGroup>
						</div>
					{:else}
						<div use:observePromptLayout={session.currentQuestion?.prompt ?? ''}>
							<RichText
								text={session.currentQuestion?.prompt ?? ''}
								class="font-serif text-base leading-7 text-foreground/90"
							/>
						</div>
						{@render mcqChoices()}
					{/if}
				</Card.Content>

				<Card.Footer
					class={cn(
						'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
						expanded && 'shrink-0 border-t'
					)}
				>
					<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
						{#if showUtilityActions && !session.hasCheckedAnswer}
							<div class="flex flex-wrap gap-2">
								<Button
									variant="ghost"
									size="sm"
									class="text-muted-foreground hover:text-foreground"
									onclick={session.handleSkipQuestion}
									disabled={session.isLoading}>{skipLabel}</Button
								>
								<Button
									variant="ghost"
									size="sm"
									class="text-muted-foreground hover:text-foreground"
									onclick={session.handleNotLearnedQuestion}
									disabled={session.isLoading}
								>
									{notLearnedLabel}
								</Button>
								<Button
									variant="ghost"
									size="sm"
									class="text-muted-foreground hover:text-foreground"
									onclick={handleReportBugAction}
								>
									{reportBugLabel}
								</Button>
							</div>
						{/if}
						{#if !quizMode && (session.hasCheckedAnswer || session.activeHintText)}
							<div class="min-w-0 space-y-1">
								<p class="text-sm text-muted-foreground">{session.feedbackMessage}</p>
							</div>
						{/if}
					</div>
					{#if quizNavigation}
						<div class="flex justify-center sm:flex-1">
							{@render quizNavigation()}
						</div>
					{/if}
					<div class="flex gap-2">
						{#if !quizMode && session.hasCheckedAnswer && session.currentQuestion?.explanation}
							<Button
								variant="outline"
								onclick={() => {
									session.showExplanation = true;
									capturePostHogEvent('explanation_viewed', {
										question_id: session.currentQuestion?.questionId,
										ap_class: selectedClass,
										unit: selectedUnit,
										topic: session.currentQuestion?.topic,
										source: session.currentQuestion?.source,
										is_correct: session.answerResult?.isCorrect
									});
								}}
							>
								{showExplanationLabel}
							</Button>
						{/if}
						<Button
							variant="outline"
							onclick={session.handleNextQuestion}
							disabled={session.isLoading ||
								(!quizMode && !session.hasCheckedAnswer) ||
								nextDisabled}
						>
							{nextLabel}
						</Button>
						{#if !session.hasCheckedAnswer && !quizMode}
							{#if session.isTreatmentActive && session.multiAttemptState.phase !== 'terminal'}
								<Button variant="outline" onclick={session.handleRevealAnswer}>Show answer</Button>
							{/if}
							<Button disabled={!selectedOption} onclick={session.handleCheckAnswer}
								>{checkLabel}</Button
							>
						{/if}
					</div>
				</Card.Footer>
			{/snippet}
			<div
				in:fade={{ duration: 280, easing: quintOut }}
				class={cn(expanded && 'flex min-h-0 flex-1 flex-col')}
			>
				<Card.Root
					class={cn(
						expanded
							? 'relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-card py-6 shadow-lg ring-1 ring-foreground/10'
							: isLandingPage
								? 'relative overflow-visible border-0 bg-transparent pt-6 shadow-none ring-0'
								: 'relative overflow-visible bg-card pt-6 shadow-xs ring-1 ring-foreground/10',
						className
					)}
				>
					{@render cardInner(expanded)}
				</Card.Root>
			</div>

			{#if expanded && practiceControls}
				<Popover.Content
					id="practice-shell-controls"
					customAnchor={controlsTriggerRef}
					align="end"
					side="bottom"
					sideOffset={8}
					class="z-[100] max-h-[calc(100vh-2rem)] w-[min(42rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] overflow-y-auto bg-popover/95 p-4 backdrop-blur-xl"
				>
					{@render practiceControls()}
				</Popover.Content>
			{/if}

			{#if session.currentQuestion && !quizMode && tutorMode !== 'hidden'}
				{#key session.currentQuestion.questionId ?? session.currentQuestion.prompt}
					{#if tutorMode === 'personalized'}
						<SuperTutorWidget
							apClass={selectedClass}
							unit={tutorUnitLabel}
							questionId={session.currentQuestion.questionId}
							topic={session.currentQuestion.topic}
							{showFirstUseHint}
						/>
					{:else}
						<TutorWidget
							apClass={selectedClass}
							unit={tutorUnitLabel}
							questionId={session.currentQuestion.questionId}
							topic={session.currentQuestion.topic}
							{isPersonalizedTutor}
							{showFirstUseHint}
						/>
					{/if}
				{/key}
			{/if}

			<BugReportDialog
				bind:open={bugReportOpen}
				context={bugReportContext}
				{selectedClass}
				{selectedUnit}
			/>

			{#if !quizMode && session.currentQuestion?.explanation}
				<Dialog.Root bind:open={session.showExplanation}>
					<Dialog.Content
						class="max-h-[min(85vh,40rem)] w-full max-w-2xl gap-0 overflow-y-auto sm:max-w-2xl"
						showCloseButton={true}
					>
						<Dialog.Header class="gap-2 text-left">
							<Dialog.Title>
								{session.checkedSelection === session.currentQuestion.correctAnswer
									? 'Correct!'
									: 'Review Explanation'}
							</Dialog.Title>
							<Dialog.Description
								class={session.currentQuestion.correctAnswer ? undefined : 'sr-only'}
							>
								{#if session.currentQuestion.correctAnswer}
									Correct answer:
									<span class="font-semibold text-foreground"
										>{session.currentQuestion.correctAnswer}</span
									>
								{:else}
									Detailed explanation for this question.
								{/if}
							</Dialog.Description>
						</Dialog.Header>
						<RichText
							text={session.currentQuestion.explanation}
							class="mt-2 text-sm leading-6 text-foreground/90"
						/>
						<Dialog.Footer class="mt-6 sm:justify-end">
							<Dialog.Close>
								{#snippet child({ props })}
									<Button variant="outline" {...props}>Close</Button>
								{/snippet}
							</Dialog.Close>
						</Dialog.Footer>
						<div class="mt-8 border-t border-border/50 pt-3">
							{#if session.questionFeedbackReason}
								<p class="mt-1.5 text-xs text-muted-foreground/70">
									Thanks, this helps improve future questions.
								</p>
							{:else}
								<div class="mt-1 flex flex-wrap gap-0.5">
									<Button
										variant="ghost"
										size="xs"
										class="text-muted-foreground"
										onclick={() => session.submitQuestionFeedback('answer_incorrect')}
										>Answer is wrong</Button
									>
									<Button
										variant="ghost"
										size="xs"
										class="text-muted-foreground"
										onclick={() => session.submitQuestionFeedback('question_unclear')}
										>Question is unclear</Button
									>
									<Button
										variant="ghost"
										size="xs"
										class="text-muted-foreground"
										onclick={() => session.submitQuestionFeedback('explanation_unclear')}
										>Explanation is unclear</Button
									>
								</div>
							{/if}
						</div>
					</Dialog.Content>
				</Dialog.Root>
			{/if}
		</div>
	</Popover.Root>
{/if}
