<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { fade, scale } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import BugReportDialog from '$lib/components/questions/bug-report-dialog.svelte';
	import McqAnswerChoices from '$lib/components/questions/mcq-answer-choices.svelte';
	import QuestionCardSkeleton from '$lib/components/questions/question-card-skeleton.svelte';
	import RichText from '$lib/components/content/rich-text.svelte';
	import * as Resizable from '$lib/components/ui/resizable/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { cn } from '$lib/utils.js';
	import { capturePostHogEvent } from '$lib/client/posthog-analytics';
	import { realisticMode } from '$lib/client/realistic-mode.svelte.js';
	import {
		measureLongQuestion,
		portalToBody,
		withTooltipTriggerClick
	} from '$lib/components/questions/question-card-dom';
	import { createQuestionCardSession } from '$lib/components/questions/question-card-session.svelte.js';
	import type { BugReportContext, QuestionCardProps } from '$lib/questions/types';
	import Maximize2Icon from '@lucide/svelte/icons/maximize-2';
	import Minimize2Icon from '@lucide/svelte/icons/minimize-2';
	import CalculatorIcon from '@lucide/svelte/icons/calculator';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import TutorWidget from '$lib/components/questions/tutor-widget.svelte';
	import DesmosCalculator from '$lib/components/questions/desmos-calculator.svelte';
	import ReferenceSheet from '$lib/components/questions/reference-sheet.svelte';
	import subjectToolsData from '$lib/data/subject-tools.json';

	let {
		class: className,
		questionNumber = '',
		selectedClass = '',
		selectedUnit = '',
		unitRange,
		requestVersion = 0,
		selectedOption = $bindable<string | null>(null),
		autoDetectLongQuestion = true,
		longQuestionThresholdChars = 450,
		autoShowExplanation = true,
		checkLabel = 'Check Answer',
		nextLabel = 'Next Question',
		showExplanationLabel = 'Show Explanation',
		showUtilityActions = true,
		skipLabel = 'Skip',
		notLearnedLabel = "I haven't learned this yet",
		reportBugLabel = 'Report a bug',
		onCheckAnswer,
		onSkip,
		onNotLearned,
		onReportBug,
		onAnswered
	}: QuestionCardProps = $props();

	let promptElement: HTMLDivElement | null = null;
	let isLongQuestion = $state(false);
	let isExpanded = $state(false);
	let mounted = $state(!browser);
	let bugReportOpen = $state(false);
	let bugReportContext = $state<BugReportContext | null>(null);
	let isMobileViewport = $state(false);
	let calculatorOpen = $state(false);
	let referenceSheetOpen = $state(false);

	const session = createQuestionCardSession({
		getSelectedClass: () => selectedClass,
		getSelectedUnit: () => selectedUnit,
		getUnitRange: () => unitRange,
		getRequestVersion: () => requestVersion,
		getQuestionNumber: () => questionNumber,
		getAutoShowExplanation: () => autoShowExplanation,
		getSelectedOption: () => selectedOption,
		getMounted: () => mounted,
		setSelectedOption: (value) => {
			selectedOption = value;
		},
		onCheckAnswer: (value) => onCheckAnswer?.(value),
		onSkip: () => onSkip?.(),
		onNotLearned: () => onNotLearned?.(),
		onAnswered: (result) => onAnswered?.(result)
	});

	type SubjectToolEntry = {
		calculator: 'none' | 'scientific' | 'graphing';
		referenceSheet: { title: string; sections: { heading: string; content: string }[] } | null;
	};
	const toolConfig = $derived(
		(subjectToolsData as Record<string, SubjectToolEntry>)[selectedClass] ??
			({ calculator: 'none', referenceSheet: null } as SubjectToolEntry)
	);
	const hasCalculator = $derived(toolConfig.calculator !== 'none');
	const hasReferenceSheet = $derived(toolConfig.referenceSheet !== null);
	const realistic = $derived(realisticMode.enabled);

	const tutorUnitLabel = $derived(selectedUnit);
	const effectiveTwoColumn = $derived(
		!isMobileViewport &&
			(session.currentQuestion?.hasStimulus || (autoDetectLongQuestion && isLongQuestion))
	);
	const expandedTwoColumn = $derived(!isMobileViewport && (isExpanded || effectiveTwoColumn));
	const tutorAnswerChoices = $derived.by(() => {
		if (!session.currentQuestion?.options) return null;
		const map: Record<string, string> = {};
		for (const opt of session.currentQuestion.options) map[opt.id] = opt.text;
		return map.A && map.B ? (map as { A: string; B: string; C: string; D: string }) : null;
	});
	const realisticContextLabel = $derived(
		selectedClass ? `${selectedClass} · ${selectedUnit.trim() || 'All Units'}` : ''
	);

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

	onMount(() => {
		calculatorOpen = false;
		referenceSheetOpen = false;
		mounted = true;

		const onResize = () => {
			isMobileViewport = window.innerWidth < 768;
			detectLongQuestionLayout();
		};
		const onKeydown = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && isExpanded) isExpanded = false;
		};
		window.addEventListener('resize', onResize);
		window.addEventListener('keydown', onKeydown);
		onResize();

		void session.init();

		return () => {
			window.removeEventListener('resize', onResize);
			window.removeEventListener('keydown', onKeydown);
		};
	});
</script>

{#if !mounted || session.isLoading}
	<QuestionCardSkeleton
		isTwoColumn={Boolean(session.currentQuestion?.hasStimulus && !isMobileViewport)}
		class={className}
	/>
{:else if session.showEmptyState}
	<Card.Root class={cn('relative overflow-visible bg-transparent shadow-none ring-0', className)}>
		<Card.Content
			class="relative flex min-h-40 flex-col items-center justify-center gap-2 px-6 pb-12 text-center"
		>
			<p class="text-lg font-medium text-muted-foreground sm:text-xl">
				Your question will display here
			</p>
			<p class="max-w-sm text-sm text-muted-foreground/80">
				Select a class and unit above, then generate a question to start practicing.
			</p>
		</Card.Content>
	</Card.Root>
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
	{#snippet cardInner(expanded: boolean)}
		{#snippet realisticQuestionNumber()}
			<div class="mb-3">
				<span
					class="inline-flex size-8 items-center justify-center bg-foreground font-exam text-base font-semibold text-background"
					aria-hidden="true"
				>
					{session.effectiveQuestionNumber}
				</span>
				<span class="sr-only">Question {session.effectiveQuestionNumber}</span>
			</div>
		{/snippet}

		{#snippet mcqChoices(compact = false)}
			<McqAnswerChoices
				options={session.currentQuestion?.options ?? []}
				{selectedOption}
				hasCheckedAnswer={session.hasCheckedAnswer}
				checkedSelection={session.checkedSelection}
				correctAnswer={session.currentQuestion?.correctAnswer}
				onSelect={session.handleOptionSelect}
				{compact}
				{realistic}
				lockedChoices={session.lockedChoices}
			/>
		{/snippet}

		<Card.Content class={cn('flex flex-col gap-6 pt-6', expanded && 'min-h-0 flex-1')}>
			<div class="flex items-start justify-between gap-4">
				{#if realistic}
					<div class="min-w-0">
						<p class="mt-0.5 truncate text-base font-medium text-foreground">
							{realisticContextLabel}
						</p>
					</div>
				{:else}
					<div>
						<h2 class="mt-0.5 text-xl font-semibold">Question {session.effectiveQuestionNumber}</h2>
					</div>
				{/if}
				<Button
					variant="ghost"
					size="icon"
					class="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
					onclick={() => (isExpanded = !isExpanded)}
					aria-label={isExpanded ? 'Collapse question' : 'Expand question'}
				>
					{#if isExpanded}
						<Minimize2Icon class="h-4 w-4" />
					{:else}
						<Maximize2Icon class="h-4 w-4" />
					{/if}
				</Button>
			</div>

			{#if session.currentQuestion?.hasStimulus && !isMobileViewport}
				<div
					class={cn(
						'overflow-hidden',
						realistic
							? 'rounded-none border border-border realistic-surface'
							: 'rounded-lg border border-border/70',
						expanded ? 'min-h-0 flex-1' : 'h-88'
					)}
				>
					<Resizable.PaneGroup direction="horizontal" class="h-full">
						<Resizable.Pane defaultSize={54} minSize={30} class="min-w-0">
							<div class="h-full space-y-3 overflow-y-auto p-4 sm:p-5">
								{#if !realistic}
									<p class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
										{session.currentQuestion.leftPanel?.title ?? 'Stimulus'}
									</p>
								{/if}
								<div
									class={cn(
										'space-y-4 leading-6',
										realistic
											? 'font-exam text-[15px] text-foreground'
											: 'text-sm text-foreground/90'
									)}
								>
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
								{#if !realistic}
									<p class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
										{session.currentQuestion.rightPanel?.title ?? 'Prompt'}
									</p>
								{/if}
								<div
									class={cn(
										'space-y-4 leading-7',
										realistic
											? 'font-exam text-[15px] text-foreground/85'
											: 'text-sm text-foreground/90'
									)}
								>
									{#each session.currentQuestion.rightPanel?.content ?? [session.currentQuestion?.prompt] as paragraph, i (`r-${i}`)}
										<RichText text={paragraph} />
									{/each}
								</div>
							</div>
						</Resizable.Pane>
					</Resizable.PaneGroup>
				</div>
				{#if realistic}
					{@render realisticQuestionNumber()}
				{/if}
				{@render mcqChoices()}
			{:else if expandedTwoColumn}
				<div
					class={cn(
						'overflow-hidden',
						realistic
							? 'rounded-none border border-border realistic-surface'
							: 'rounded-lg border border-border/70',
						expanded ? 'min-h-0 flex-1' : 'h-100'
					)}
				>
					<Resizable.PaneGroup direction="horizontal" class="h-full">
						<Resizable.Pane defaultSize={56} minSize={35} class="min-w-0">
							<div
								use:observePromptLayout={session.currentQuestion?.prompt ?? ''}
								class="h-full overflow-y-auto p-4 sm:p-5"
							>
								{#if !realistic}
									<p
										class="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
									>
										Question
									</p>
								{/if}
								<RichText
									text={session.currentQuestion?.prompt ?? ''}
									class={cn(
										'leading-7',
										realistic
											? 'font-exam text-[15px] text-foreground/85'
											: 'text-sm text-foreground/90'
									)}
								/>
							</div>
						</Resizable.Pane>
						<Resizable.Handle withHandle />
						<Resizable.Pane defaultSize={44} minSize={30} class="min-w-0">
							<div class="h-full overflow-y-auto p-4 sm:p-5">
								{#if realistic}
									{@render realisticQuestionNumber()}
								{/if}
								{@render mcqChoices(true)}
							</div>
						</Resizable.Pane>
					</Resizable.PaneGroup>
				</div>
			{:else}
				<div use:observePromptLayout={session.currentQuestion?.prompt ?? ''}>
					<RichText
						text={session.currentQuestion?.prompt ?? ''}
						class={cn(
							realistic
								? 'font-exam text-[15px] leading-8 text-foreground/85'
								: 'text-base leading-7 text-foreground/90'
						)}
					/>
				</div>
				{#if realistic}
					{@render realisticQuestionNumber()}
				{/if}
				{@render mcqChoices()}
			{/if}

			{#if showUtilityActions && !session.hasCheckedAnswer}
				<div class="flex flex-wrap gap-2">
					<Button
						variant="ghost"
						size="sm"
						onclick={session.handleSkipQuestion}
						disabled={session.isLoading}>{skipLabel}</Button
					>
					<Button
						variant="ghost"
						size="sm"
						onclick={session.handleNotLearnedQuestion}
						disabled={session.isLoading}
					>
						{notLearnedLabel}
					</Button>
					<Button variant="ghost" size="sm" onclick={handleReportBugAction}>
						{reportBugLabel}
					</Button>
				</div>
			{/if}
		</Card.Content>

		<Card.Footer class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
				<div class="min-w-0 space-y-1">
					<p class="text-sm text-muted-foreground">{session.feedbackMessage}</p>
				</div>
				{#if hasCalculator || hasReferenceSheet}
					<div class="flex gap-0.5">
						{#if hasCalculator}
							<Tooltip.Root>
								<Tooltip.Trigger>
									{#snippet child({ props })}
										<Button
											{...props}
											variant="ghost"
											size="icon"
											class="h-7 w-7 text-muted-foreground hover:text-foreground"
											onclick={withTooltipTriggerClick(props, () => {
												calculatorOpen = !calculatorOpen;
											})}
											aria-label="Open Calculator"
										>
											<CalculatorIcon class="h-3.5 w-3.5" />
										</Button>
									{/snippet}
								</Tooltip.Trigger>
								<Tooltip.Content side="top" sideOffset={6}>Open Calculator</Tooltip.Content>
							</Tooltip.Root>
						{/if}
						{#if hasReferenceSheet}
							<Tooltip.Root>
								<Tooltip.Trigger>
									{#snippet child({ props })}
										<Button
											{...props}
											variant="ghost"
											size="icon"
											class="h-7 w-7 text-muted-foreground hover:text-foreground"
											onclick={withTooltipTriggerClick(props, () => {
												referenceSheetOpen = !referenceSheetOpen;
											})}
											aria-label="Reference Sheet"
										>
											<BookOpenIcon class="h-3.5 w-3.5" />
										</Button>
									{/snippet}
								</Tooltip.Trigger>
								<Tooltip.Content side="top" sideOffset={6}>Reference Sheet</Tooltip.Content>
							</Tooltip.Root>
						{/if}
					</div>
				{/if}
			</div>
			<div class="flex gap-2">
				{#if session.hasCheckedAnswer && session.currentQuestion?.explanation}
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
					disabled={session.isLoading || !session.hasCheckedAnswer}
				>
					{nextLabel}
				</Button>
				{#if !session.hasCheckedAnswer}
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

	<!-- Normal card (kept in the DOM to preserve layout space; hidden while expanded) -->
	<div in:fade={{ duration: 280, easing: quintOut }}>
		<Card.Root
			class={cn(
				realistic
					? 'relative overflow-hidden border-border/70 realistic-surface shadow-none'
					: 'relative overflow-hidden border-border/70 bg-card/95 shadow-sm backdrop-blur-sm',
				isExpanded ? 'pointer-events-none invisible' : className
			)}
			aria-hidden={isExpanded}
		>
			{@render cardInner(false)}
		</Card.Root>
	</div>

	<!-- Fullscreen overlay - scales in/out smoothly -->
	{#if isExpanded}
		<div
			use:portalToBody
			class="fixed inset-0 z-50 flex flex-col"
			transition:scale={{ duration: 240, start: 0.97, opacity: 0, easing: quintOut }}
		>
			<Card.Root
				class={cn(
					'relative flex h-full flex-col overflow-hidden',
					realistic
						? 'rounded-none border-0 realistic-surface shadow-none'
						: 'rounded-none border-0 bg-card/98 shadow-2xl backdrop-blur-sm'
				)}
			>
				{@render cardInner(true)}
			</Card.Root>
		</div>
	{/if}

	{#if session.currentQuestion}
		{#key session.currentQuestion.questionId ?? session.currentQuestion.prompt}
			<TutorWidget
				question={session.currentQuestion.prompt}
				answer={session.currentQuestion.correctAnswer ?? ''}
				explanation={session.currentQuestion.explanation ?? ''}
				apClass={selectedClass}
				unit={tutorUnitLabel}
				answerChoices={tutorAnswerChoices}
				questionId={session.currentQuestion.questionId}
				topic={session.currentQuestion.topic}
			/>
		{/key}
	{/if}

	{#if calculatorOpen}
		<DesmosCalculator
			type={toolConfig.calculator as 'scientific' | 'graphing'}
			onClose={() => (calculatorOpen = false)}
		/>
	{/if}

	<ReferenceSheet bind:open={referenceSheetOpen} referenceSheet={toolConfig.referenceSheet} />

	<BugReportDialog
		bind:open={bugReportOpen}
		context={bugReportContext}
		{selectedClass}
		{selectedUnit}
	/>

	{#if session.currentQuestion?.explanation}
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
{/if}
