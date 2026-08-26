<script lang="ts">
	import { onMount } from 'svelte';
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
	import AnnotatableRichText from '$lib/components/questions/annotatable-rich-text.svelte';
	import * as Resizable from '$lib/components/ui/resizable/index.js';
	import { cn } from '$lib/utils.js';
	import { capturePostHogEvent } from '$lib/client/posthog-analytics';
	import { measureLongQuestion } from '$lib/components/questions/question-card-dom';
	import { portalToBody } from '$lib/components/questions/portal-to-body.svelte.js';
	import { createQuestionCore } from '$lib/components/questions/question-core.svelte.js';
	import type { BugReportContext, QuestionCardProps } from '$lib/question-bank/mcq/types';
	import SlidersHorizontalIcon from '@tabler/icons-svelte/icons/adjustments-horizontal';
	import ArrowsMaximizeIcon from '@tabler/icons-svelte/icons/arrows-maximize';
	import ArrowsMinimizeIcon from '@tabler/icons-svelte/icons/arrows-minimize';
	import TutorWidget from '$lib/components/questions/tutor-widget.svelte';
	import SuperTutorWidget from '$lib/components/questions/super-tutor-widget.svelte';
	import ExamfigDiagram from '$lib/components/questions/examfig-diagram.svelte';
	import { IsMobile } from '$lib/hooks/is-mobile.svelte.js';

	const lightbulbImage = '/illustrations/lightbulb.png';

	let {
		model,
		class: className,
		expanded = $bindable(false),
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

	const isMobile = new IsMobile();
	let promptElement: HTMLDivElement | null = null;
	let isLongQuestion = $state(false);
	let mounted = $state(false);
	let bugReportOpen = $state(false);
	let bugReportContext = $state<BugReportContext | null>(null);
	let controlsTriggerRef = $state<HTMLElement | null>(null);

	const core = createQuestionCore({
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
		onQuizNext: () => onQuizNext?.()
	});

	const tutorUnitLabel = $derived(selectedUnit);
	const effectiveTwoColumn = $derived(
		!isMobile.current &&
			(core.currentQuestion?.hasStimulus || (autoDetectLongQuestion && isLongQuestion))
	);
	/** Fullscreen unlimited always uses two columns on desktop; otherwise long/stimulus. */
	const useTwoColumn = $derived(!isMobile.current && (expanded || effectiveTwoColumn));

	function detectLongQuestionLayout(node: HTMLDivElement | null = promptElement): void {
		isLongQuestion = measureLongQuestion({
			prompt: core.currentQuestion?.prompt ?? '',
			node,
			longQuestionThresholdChars
		});
	}

	function observePromptLayout(promptText: string) {
		return (node: HTMLDivElement) => {
			void promptText;
			promptElement = node;

			const measure = () => {
				detectLongQuestionLayout(node);
			};

			const frame = requestAnimationFrame(measure);
			const resizeObserver = new ResizeObserver(measure);
			resizeObserver.observe(node);

			return () => {
				resizeObserver.disconnect();
				cancelAnimationFrame(frame);
				if (promptElement === node) {
					promptElement = null;
				}
			};
		};
	}

	function handleReportBugAction(): void {
		const ctx: BugReportContext = {
			questionId: core.currentQuestion?.questionId,
			questionNumber: core.effectiveQuestionNumber,
			selectedClass,
			selectedUnit,
			prompt: core.currentQuestion?.prompt,
			correctAnswer: core.currentQuestion?.correctAnswer,
			hasStimulus: Boolean(core.currentQuestion?.hasStimulus)
		};
		onReportBug?.(ctx);
		bugReportContext = ctx;
		bugReportOpen = true;
	}

	function openExplanation(): void {
		core.setShowExplanation(true);
		capturePostHogEvent('explanation_viewed', {
			question_id: core.currentQuestion?.questionId,
			ap_class: selectedClass,
			unit: selectedUnit,
			topic: core.currentQuestion?.topic,
			source: core.currentQuestion?.source,
			is_correct: core.answerResult?.isCorrect
		});
	}

	const showQuestionSkeleton = $derived(
		!core.currentQuestion &&
			(core.isLoading ||
				quizMode ||
				(requestVersion > 0 && !core.showWarmingState && !core.showErrorState))
	);

	onMount(() => {
		mounted = true;
		void core.init();

		function handleKeydown(event: KeyboardEvent): void {
			if (event.key === 'Escape' && expanded) {
				expanded = false;
				controlsOpen = false;
			}
		}

		window.addEventListener('keydown', handleKeydown);
		return () => {
			core.destroy();
			window.removeEventListener('keydown', handleKeydown);
		};
	});

	let lastLoadedRequestVersion = 0;
	$effect(() => {
		const version = requestVersion;
		if (!mounted || version === 0 || version === lastLoadedRequestVersion) return;
		lastLoadedRequestVersion = version;
		void core.loadQuestion();
	});
</script>

{#if core.showWarmingState}
	<Card.Root class={cn('relative overflow-visible bg-transparent shadow-none ring-0', className)}>
		<Card.Content
			class="relative flex min-h-40 flex-col items-center justify-center gap-3 px-6 pb-12 text-center"
		>
			<p class="text-lg font-medium text-muted-foreground sm:text-xl">Practice is warming up</p>
			<p class="max-w-sm text-sm text-muted-foreground/80">
				{core.statusMessage ||
					'This course unit is still being prepared. Your class and unit selection are unchanged — retry in a moment.'}
			</p>
			<p class="text-xs text-muted-foreground/70">
				Typical wait about {core.poolWarmingRetryAfterSeconds}s
			</p>
			<Button onclick={() => void core.retryWarmingLoad()} disabled={core.isLoading}>
				{core.isLoading ? 'Checking…' : 'Retry now'}
			</Button>
		</Card.Content>
	</Card.Root>
{:else if showQuestionSkeleton}
	<QuestionCardSkeleton class={className} />
{:else if core.showEmptyState}
	<EmptyState
		title="Ready When You Are"
		description="Select a course and unit, then generate a question."
		imageUrl={lightbulbImage}
	/>
{:else if core.showErrorState}
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
			<Button onclick={() => void core.loadQuestion()} disabled={core.isLoading}>Try again</Button>
		</Card.Content>
	</Card.Root>
{:else}
	{#snippet mcqChoices(compact = false)}
		<McqAnswerChoices
			options={core.currentQuestion?.options ?? []}
			{selectedOption}
			struckOptionIds={core.optionMarks.struckOptionIds}
			hasCheckedAnswer={core.hasCheckedAnswer}
			checkedSelection={core.checkedSelection}
			correctAnswer={core.currentQuestion?.correctAnswer}
			onSelect={core.selectOption}
			onToggleStrike={core.toggleOptionStrike}
			textAnnotations={core.textAnnotations}
			onAddTextAnnotation={core.addTextAnnotation}
			onRemoveTextAnnotation={core.removeAnnotation}
			annotationsDisabled={core.hasCheckedAnswer}
			showFeedback={!quizMode}
			{compact}
		/>
	{/snippet}

	{#snippet promptBody()}
		{#if core.currentQuestion?.hasStimulus && core.currentQuestion.rightPanel}
			{#if core.currentQuestion.rightPanel.title}
				<p class="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
					{core.currentQuestion.rightPanel.title}
				</p>
			{/if}
			<div class="space-y-4 font-serif text-sm leading-7 text-foreground/90">
				{#each core.currentQuestion.rightPanel.content as paragraph, i (`r-${i}`)}
					<AnnotatableRichText
						text={paragraph}
						target={{ kind: 'prompt', paragraphIndex: i }}
						annotations={core.textAnnotations}
						disabled={core.hasCheckedAnswer}
						onAddAnnotation={core.addTextAnnotation}
						onRemoveAnnotation={core.removeAnnotation}
					/>
				{/each}
			</div>
		{:else}
			<p class="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
				Question
			</p>
			<AnnotatableRichText
				text={core.currentQuestion?.prompt ?? ''}
				target={{ kind: 'prompt', paragraphIndex: 0 }}
				annotations={core.textAnnotations}
				disabled={core.hasCheckedAnswer}
				onAddAnnotation={core.addTextAnnotation}
				onRemoveAnnotation={core.removeAnnotation}
				class="font-serif text-sm leading-7 text-foreground/90"
			/>
		{/if}
	{/snippet}

	<Popover.Root bind:open={controlsOpen}>
		<div
			{@attach portalToBody(expanded)}
			class={cn(
				expanded
					? 'fixed inset-0 z-50 flex h-dvh min-h-0 flex-col overflow-hidden bg-background p-3 sm:p-4'
					: 'contents'
			)}
		>
			<div class={expanded ? 'flex min-h-0 flex-1 flex-col' : 'contents'}>
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
						<Card.Content class={cn('flex flex-col gap-6 pt-0 pb-0', expanded && 'min-h-0 flex-1')}>
							<div class="flex shrink-0 items-start justify-between gap-4">
								<div>
									<h2 class="mt-0.5 text-xl font-semibold">
										Question {core.effectiveQuestionNumber}
									</h2>
								</div>
								<div class="flex items-center gap-1">
									{#if headerActions}
										{@render headerActions()}
									{/if}
									{#if !quizMode}
										<Button
											variant="ghost"
											size="icon"
											class="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
											aria-label={expanded ? 'Exit fullscreen' : 'Enter fullscreen'}
											onclick={() => (expanded = !expanded)}
										>
											{#if expanded}
												<ArrowsMinimizeIcon class="size-4" />
											{:else}
												<ArrowsMaximizeIcon class="size-4" />
											{/if}
										</Button>
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
								</div>
							</div>

							{#if core.currentQuestion?.diagramSpec && !useTwoColumn}
								<ExamfigDiagram spec={core.currentQuestion.diagramSpec} />
							{/if}

							{#if useTwoColumn && core.currentQuestion?.hasStimulus}
								<div
									class={cn(
										'overflow-hidden rounded-lg border border-border/70',
										expanded ? 'min-h-0 flex-1' : 'h-88'
									)}
								>
									<Resizable.PaneGroup direction="horizontal" class="h-full">
										<Resizable.Pane defaultSize={50} minSize={28} class="min-w-0">
											<div class="h-full space-y-3 overflow-y-auto p-4 sm:p-5">
												<p
													class="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
												>
													{core.currentQuestion.leftPanel?.title ?? 'Stimulus'}
												</p>
												<div class="space-y-4 font-serif text-sm leading-6 text-foreground/90">
													{#each core.currentQuestion.leftPanel?.content ?? [] as paragraph, i (`l-${i}`)}
														<AnnotatableRichText
															text={paragraph}
															target={{ kind: 'stimulus', paragraphIndex: i }}
															annotations={core.textAnnotations}
															disabled={core.hasCheckedAnswer}
															onAddAnnotation={core.addTextAnnotation}
															onRemoveAnnotation={core.removeAnnotation}
														/>
													{/each}
												</div>
												{#if core.currentQuestion.diagramSpec}
													<ExamfigDiagram spec={core.currentQuestion.diagramSpec} />
												{/if}
											</div>
										</Resizable.Pane>
										<Resizable.Handle withHandle />
										<Resizable.Pane defaultSize={50} minSize={28} class="min-w-0">
											<div class="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4 sm:p-5">
												<div {@attach observePromptLayout(core.currentQuestion?.prompt ?? '')}>
													{@render promptBody()}
												</div>
												{@render mcqChoices(true)}
											</div>
										</Resizable.Pane>
									</Resizable.PaneGroup>
								</div>
							{:else if useTwoColumn}
								<div
									class={cn(
										'overflow-hidden rounded-lg border border-border/70',
										expanded ? 'min-h-0 flex-1' : 'h-100'
									)}
								>
									<Resizable.PaneGroup direction="horizontal" class="h-full">
										<Resizable.Pane defaultSize={56} minSize={35} class="min-w-0">
											<div
												{@attach observePromptLayout(core.currentQuestion?.prompt ?? '')}
												class="h-full overflow-y-auto p-4 sm:p-5"
											>
												{#if core.currentQuestion?.diagramSpec}
													<div class="mb-4">
														<ExamfigDiagram spec={core.currentQuestion.diagramSpec} />
													</div>
												{/if}
												{@render promptBody()}
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
								{#if core.currentQuestion?.diagramSpec}
									<ExamfigDiagram spec={core.currentQuestion.diagramSpec} />
								{/if}
								<div {@attach observePromptLayout(core.currentQuestion?.prompt ?? '')}>
									<AnnotatableRichText
										text={core.currentQuestion?.prompt ?? ''}
										target={{ kind: 'prompt', paragraphIndex: 0 }}
										annotations={core.textAnnotations}
										disabled={core.hasCheckedAnswer}
										onAddAnnotation={core.addTextAnnotation}
										onRemoveAnnotation={core.removeAnnotation}
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
								{#if showUtilityActions && !core.hasCheckedAnswer}
									<div class="flex flex-wrap gap-2">
										<Button
											variant="ghost"
											size="sm"
											class="text-muted-foreground hover:text-foreground"
											onclick={() => void core.skip()}
											disabled={core.isLoading}>{skipLabel}</Button
										>
										<Button
											variant="ghost"
											size="sm"
											class="text-muted-foreground hover:text-foreground"
											onclick={() => void core.notLearned()}
											disabled={core.isLoading}
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
								{#if !quizMode && core.hasCheckedAnswer}
									<div class="min-w-0 space-y-1">
										<p class="text-sm text-muted-foreground">{core.feedbackMessage}</p>
									</div>
								{/if}
							</div>
							{#if quizNavigation}
								<div class="flex justify-center sm:flex-1">
									{@render quizNavigation()}
								</div>
							{/if}
							<div class="flex gap-2">
								{#if !quizMode && core.hasCheckedAnswer && core.currentQuestion?.explanation}
									<Button variant="outline" onclick={openExplanation}>
										{showExplanationLabel}
									</Button>
								{/if}
								<Button
									variant="outline"
									onclick={() => void core.next()}
									disabled={core.isLoading || (!quizMode && !core.hasCheckedAnswer) || nextDisabled}
								>
									{nextLabel}
								</Button>
								{#if !core.hasCheckedAnswer && !quizMode}
									<Button disabled={!selectedOption} onclick={() => core.checkAnswer()}
										>{checkLabel}</Button
									>
								{/if}
							</div>
						</Card.Footer>
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
			</div>
		</div>
	</Popover.Root>

	{#if core.currentQuestion && !quizMode && !expanded && tutorMode !== 'hidden'}
		{#key core.currentQuestion.questionId ?? core.currentQuestion.prompt}
			{#if tutorMode === 'personalized'}
				<SuperTutorWidget
					apClass={selectedClass}
					unit={tutorUnitLabel}
					questionId={core.currentQuestion.questionId}
					topic={core.currentQuestion.topic}
					{showFirstUseHint}
				/>
			{:else}
				<TutorWidget
					apClass={selectedClass}
					unit={tutorUnitLabel}
					questionId={core.currentQuestion.questionId}
					topic={core.currentQuestion.topic}
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

	{#if !quizMode && core.currentQuestion?.explanation}
		<Dialog.Root open={core.showExplanation} onOpenChange={(open) => core.setShowExplanation(open)}>
			<Dialog.Content
				class="max-h-[min(85vh,40rem)] w-full max-w-2xl gap-0 overflow-y-auto sm:max-w-2xl"
				showCloseButton={true}
			>
				<Dialog.Header class="gap-2 text-left">
					<Dialog.Title>
						{core.checkedSelection === core.currentQuestion.correctAnswer
							? 'Correct!'
							: 'Review Explanation'}
					</Dialog.Title>
					<Dialog.Description class={core.currentQuestion.correctAnswer ? undefined : 'sr-only'}>
						{#if core.currentQuestion.correctAnswer}
							Correct answer:
							<span class="font-semibold text-foreground">{core.currentQuestion.correctAnswer}</span
							>
						{:else}
							Detailed explanation for this question.
						{/if}
					</Dialog.Description>
				</Dialog.Header>
				<RichText
					text={core.currentQuestion.explanation}
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
					{#if core.questionFeedbackReason}
						<p class="mt-1.5 text-xs text-muted-foreground/70">
							Thanks, this helps improve future questions.
						</p>
					{:else}
						<div class="mt-1 flex flex-wrap gap-0.5">
							<Button
								variant="ghost"
								size="xs"
								class="text-muted-foreground"
								onclick={() => core.submitQuestionFeedback('answer_incorrect')}
								>Answer is wrong</Button
							>
							<Button
								variant="ghost"
								size="xs"
								class="text-muted-foreground"
								onclick={() => core.submitQuestionFeedback('question_unclear')}
								>Question is unclear</Button
							>
							<Button
								variant="ghost"
								size="xs"
								class="text-muted-foreground"
								onclick={() => core.submitQuestionFeedback('explanation_unclear')}
								>Explanation is unclear</Button
							>
						</div>
					{/if}
				</div>
			</Dialog.Content>
		</Dialog.Root>
	{/if}
{/if}
