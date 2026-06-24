<script lang="ts" module>
	export type * from '$lib/types/question.js';
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { scale } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import BugReportDialog from '$lib/components/bug-report-dialog.svelte';
	import McqAnswerChoices from '$lib/components/mcq-answer-choices.svelte';
	import QuestionCardSkeleton from '$lib/components/question-card-skeleton.svelte';
	import RichText from '$lib/components/rich-text.svelte';
	import * as Resizable from '$lib/components/ui/resizable/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { cn } from '$lib/utils.js';
	import { apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/api.js';
	import {
		parseQuestionPayloadFromResponse,
		resolveEffectiveUnit,
		type QuestionApiResponse
	} from '$lib/client/question-payload.js';
	import type {
		AnswerResult,
		BugReportContext,
		GeneratedQuestion,
		QuestionCardProps
	} from '$lib/types/question';
	import Maximize2Icon from '@lucide/svelte/icons/maximize-2';
	import Minimize2Icon from '@lucide/svelte/icons/minimize-2';
	import CalculatorIcon from '@lucide/svelte/icons/calculator';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import TutorWidget from '$lib/components/tutor/tutor-widget.svelte';
	import DesmosCalculator from '$lib/components/desmos-calculator.svelte';
	import ReferenceSheet from '$lib/components/reference-sheet.svelte';
	import subjectToolsData from '$lib/data/subject-tools.json';
	import { hashTopicKey, isCustomUnit } from '$lib/constants/custom-unit';

	/** Merge Tooltip.Trigger onclick with a custom handler (spread props override bare onclick). */
	function withTooltipTriggerClick(
		triggerProps: { onclick?: (e: MouseEvent) => void },
		action: () => void
	) {
		return (e: MouseEvent) => {
			triggerProps.onclick?.(e);
			action();
		};
	}

	let {
		class: className,
		questionNumber = '',
		selectedClass = '',
		selectedUnit = '',
		customTopic = '',
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
	let hasCheckedAnswer = $state(false);
	let isExpanded = $state(false);
	let checkedSelection = $state<string | null>(null);
	let answerResult = $state<AnswerResult | null>(null);
	let showExplanation = $state(false);
	let startedAtMs = $state(Date.now());
	let isLoading = $state(false);
	let mounted = $state(!browser);
	let questionCount = $state(0);
	let statusMessage = $state('');
	let currentQuestion = $state<GeneratedQuestion | null>(null);
	let bugReportOpen = $state(false);
	let bugReportContext = $state<BugReportContext | null>(null);
	let isMobileViewport = $state(false);
	let calculatorOpen = $state(false);
	let referenceSheetOpen = $state(false);

	/** One-slot client prefetch for custom-topic flows only (next question while you work on the current one). */
	let prefetchedCustomMcq = $state<{ key: string; question: GeneratedQuestion } | null>(null);
	let prefetchMcqInFlightKey = $state<string | null>(null);

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

	const effectiveQuestionNumber = $derived(questionNumber || `${questionCount}`);
	const tutorUnitLabel = $derived(
		isCustomUnit(selectedUnit) ? customTopic.trim() || 'Custom topic' : selectedUnit
	);
	const effectiveTwoColumn = $derived(
		!isMobileViewport &&
			(currentQuestion?.hasStimulus || (autoDetectLongQuestion && isLongQuestion))
	);
	const expandedTwoColumn = $derived(!isMobileViewport && (isExpanded || effectiveTwoColumn));
	const tutorAnswerChoices = $derived.by(() => {
		if (!currentQuestion?.options) return null;
		const map: Record<string, string> = {};
		for (const opt of currentQuestion.options) map[opt.id] = opt.text;
		return map.A && map.B ? (map as { A: string; B: string; C: string; D: string }) : null;
	});
	const feedbackMessage = $derived.by(() => {
		if (!hasCheckedAnswer || !answerResult || !currentQuestion?.correctAnswer) {
			return statusMessage;
		}
		if (answerResult.isCorrect) {
			return 'Correct! Nice work.';
		}
		return `Incorrect. Correct answer: ${answerResult.correctAnswer}.`;
	});

	const showEmptyState = $derived(
		mounted && !isLoading && requestVersion === 0 && !currentQuestion
	);

	function customTopicCacheKey(): string {
		return `${selectedClass}::${hashTopicKey(customTopic.trim())}`;
	}

	$effect(() => {
		if (!browser) return;
		if (!isCustomUnit(selectedUnit) || !customTopic.trim()) {
			prefetchedCustomMcq = null;
			return;
		}
		const k = customTopicCacheKey();
		if (prefetchedCustomMcq && prefetchedCustomMcq.key !== k) prefetchedCustomMcq = null;
	});

	async function requestQuestion(
		className: string,
		unit: string,
		topicOverride: string | undefined = undefined
	): Promise<QuestionApiResponse> {
		const body: Record<string, string> = { className, unit };
		const t = topicOverride?.trim();
		if (t) body.customTopic = t;

		const response = await apiFetch('/api/question', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});

		const payload = await readJsonOrNull<QuestionApiResponse>(response);
		if (!response.ok || !payload) {
			throw new Error(getResponseMessage(payload, 'Failed to load question.'));
		}

		return payload;
	}

	function prefetchNextCustomMcq(): void {
		if (!browser) return;
		if (!isCustomUnit(selectedUnit)) return;
		const topicTrim = customTopic.trim();
		if (!topicTrim || !selectedClass) return;
		const key = customTopicCacheKey();
		if (prefetchedCustomMcq?.key === key) return;
		if (prefetchMcqInFlightKey === key) return;
		prefetchMcqInFlightKey = key;
		void (async () => {
			try {
				const response = await requestQuestion(selectedClass, '', topicTrim);
				const normalized = parseQuestionPayloadFromResponse(response);
				if (customTopicCacheKey() !== key || !isCustomUnit(selectedUnit)) return;
				prefetchedCustomMcq = { key, question: normalized };
			} catch {
				// Prefetch is best-effort only.
			} finally {
				if (prefetchMcqInFlightKey === key) prefetchMcqInFlightKey = null;
			}
		})();
	}

	function detectLongQuestionLayout(node: HTMLDivElement | null = promptElement): void {
		const textLength = currentQuestion?.prompt.length ?? 0;
		const hasCodeBlock = /```|\n\s{2,}|<code/i.test(currentQuestion?.prompt ?? '');
		const questionHeight = node?.scrollHeight ?? 0;
		const threshold = Math.min(window.innerHeight * 0.7, 600);
		isLongQuestion =
			textLength > longQuestionThresholdChars || hasCodeBlock || questionHeight > threshold;
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

	function portalToBody(node: HTMLElement) {
		if (!browser) return;

		const originalOverflow = document.body.style.overflow;
		document.body.appendChild(node);
		document.body.style.overflow = 'hidden';

		return {
			destroy() {
				document.body.style.overflow = originalOverflow;
				node.remove();
			}
		};
	}

	function resetInteractionState(clearSelection = true): void {
		hasCheckedAnswer = false;
		checkedSelection = null;
		answerResult = null;
		showExplanation = false;
		startedAtMs = Date.now();
		if (clearSelection) selectedOption = null;
	}

	function buildAnswerResult(selectedAnswer: string): AnswerResult | null {
		if (!currentQuestion?.correctAnswer) return null;

		return {
			questionId: currentQuestion.questionId,
			questionNumber: effectiveQuestionNumber,
			selectedAnswer,
			correctAnswer: currentQuestion.correctAnswer,
			isCorrect: selectedAnswer === currentQuestion.correctAnswer,
			timeTakenMs: Date.now() - startedAtMs
		};
	}

	async function loadQuestion(
		reason: 'skip' | 'not-learned' | 'next' | undefined = undefined
	): Promise<void> {
		if (isLoading) return;
		if (!selectedClass) {
			statusMessage = 'Please choose a class before requesting a question.';
			return;
		}

		const custom = isCustomUnit(selectedUnit);
		const topicTrim = customTopic.trim();
		if (custom && !topicTrim) {
			statusMessage = 'Enter a topic for your custom question.';
			return;
		}

		// Instant path: one client-cached question for the same custom class+topic.
		if (
			custom &&
			topicTrim &&
			prefetchedCustomMcq &&
			prefetchedCustomMcq.key === customTopicCacheKey()
		) {
			const cached = prefetchedCustomMcq.question;
			prefetchedCustomMcq = null;
			if (reason === 'skip') statusMessage = 'Skipped current question.';
			else if (reason === 'not-learned') statusMessage = "Marked as: I haven't learned this yet.";
			else statusMessage = 'Choose the best answer and then check your response.';
			currentQuestion = cached;
			questionCount += 1;
			resetInteractionState(true);
			prefetchNextCustomMcq();
			return;
		}

		isLoading = true;

		if (reason === 'skip') statusMessage = 'Skipped current question.';
		else if (reason === 'not-learned') statusMessage = "Marked as: I haven't learned this yet.";
		else statusMessage = 'Loading question...';

		try {
			const effectiveUnit = custom ? '' : resolveEffectiveUnit(selectedClass, selectedUnit);
			const response = await requestQuestion(
				selectedClass,
				effectiveUnit,
				custom ? topicTrim : undefined
			);

			const normalized = parseQuestionPayloadFromResponse(response);

			currentQuestion = normalized;
			questionCount += 1;
			statusMessage = 'Choose the best answer and then check your response.';
			resetInteractionState(true);
			if (custom && topicTrim) prefetchNextCustomMcq();
		} catch (error) {
			statusMessage = error instanceof Error ? error.message : 'Could not load question.';
		} finally {
			isLoading = false;
		}
	}

	function handleOptionSelect(optionId: string): void {
		if (hasCheckedAnswer) return;
		selectedOption = optionId;
	}

	function handleCheckAnswer(): void {
		if (!selectedOption) return;
		onCheckAnswer?.(selectedOption);
		const result = buildAnswerResult(selectedOption);
		if (!result) return;

		hasCheckedAnswer = true;
		checkedSelection = result.selectedAnswer;
		answerResult = result;

		onAnswered?.(result);

		if (autoShowExplanation && currentQuestion?.explanation) {
			showExplanation = true;
		}
	}

	async function handleNextQuestion(): Promise<void> {
		await loadQuestion('next');
	}

	async function handleSkipQuestion(): Promise<void> {
		onSkip?.();
		await loadQuestion('skip');
	}

	async function handleNotLearnedQuestion(): Promise<void> {
		onNotLearned?.();
		await loadQuestion('not-learned');
	}

	function handleReportBugAction(): void {
		const ctx: BugReportContext = {
			questionId: currentQuestion?.questionId,
			questionNumber: effectiveQuestionNumber,
			selectedClass,
			selectedUnit,
			customTopic,
			prompt: currentQuestion?.prompt,
			correctAnswer: currentQuestion?.correctAnswer,
			hasStimulus: Boolean(currentQuestion?.hasStimulus)
		};
		onReportBug?.(ctx);
		bugReportContext = ctx;
		bugReportOpen = true;
	}

	onMount(() => {
		currentQuestion = null;
		questionCount = 0;
		resetInteractionState(true);
		calculatorOpen = false;
		referenceSheetOpen = false;
		statusMessage = 'Choose the best answer and then check your response.';
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

		if (requestVersion > 0) {
			void loadQuestion();
		} else if (currentQuestion) {
			isLoading = false;
		}

		return () => {
			window.removeEventListener('resize', onResize);
			window.removeEventListener('keydown', onKeydown);
		};
	});
</script>

{#if !mounted || isLoading}
	<QuestionCardSkeleton
		isTwoColumn={Boolean(currentQuestion?.hasStimulus && !isMobileViewport)}
		class={className}
	/>
{:else if showEmptyState}
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
{:else}
	{#snippet cardInner(expanded: boolean)}
		<Card.Content class={cn('flex flex-col gap-6 pt-6', expanded && 'min-h-0 flex-1')}>
			<div class="flex items-start justify-between">
				<div>
					<h2 class="mt-0.5 text-xl font-semibold">Question {effectiveQuestionNumber}</h2>
				</div>
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

			{#if currentQuestion?.hasStimulus && !isMobileViewport}
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
									{currentQuestion.leftPanel?.title ?? 'Stimulus'}
								</p>
								<div class="space-y-4 text-sm leading-6 text-foreground/90">
									{#each currentQuestion.leftPanel?.content ?? [] as paragraph, i (`l-${i}`)}
										<RichText text={paragraph} />
									{/each}
								</div>
							</div>
						</Resizable.Pane>
						<Resizable.Handle withHandle />
						<Resizable.Pane defaultSize={46} minSize={30} class="min-w-0">
							<div
								use:observePromptLayout={currentQuestion?.prompt ?? ''}
								class="h-full space-y-3 overflow-y-auto p-4 sm:p-5"
							>
								<p class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
									{currentQuestion.rightPanel?.title ?? 'Prompt'}
								</p>
								<div class="space-y-4 text-sm leading-6 text-foreground/90">
									{#each currentQuestion.rightPanel?.content ?? [currentQuestion?.prompt] as paragraph, i (`r-${i}`)}
										<RichText text={paragraph} />
									{/each}
								</div>
							</div>
						</Resizable.Pane>
					</Resizable.PaneGroup>
				</div>
				<McqAnswerChoices
					options={currentQuestion.options}
					{selectedOption}
					{hasCheckedAnswer}
					{checkedSelection}
					correctAnswer={currentQuestion.correctAnswer}
					onSelect={handleOptionSelect}
				/>
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
								use:observePromptLayout={currentQuestion?.prompt ?? ''}
								class="h-full overflow-y-auto p-4 sm:p-5"
							>
								<p class="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
									Question
								</p>
								<RichText
									text={currentQuestion?.prompt ?? ''}
									class="text-sm leading-6 text-foreground/90"
								/>
							</div>
						</Resizable.Pane>
						<Resizable.Handle withHandle />
						<Resizable.Pane defaultSize={44} minSize={30} class="min-w-0">
							<div class="h-full overflow-y-auto p-4 sm:p-5">
								<McqAnswerChoices
									options={currentQuestion?.options ?? []}
									{selectedOption}
									{hasCheckedAnswer}
									{checkedSelection}
									correctAnswer={currentQuestion?.correctAnswer}
									onSelect={handleOptionSelect}
									compact
								/>
							</div>
						</Resizable.Pane>
					</Resizable.PaneGroup>
				</div>
			{:else}
				<div use:observePromptLayout={currentQuestion?.prompt ?? ''}>
					<RichText
						text={currentQuestion?.prompt ?? ''}
						class="text-base leading-7 text-foreground/90"
					/>
				</div>
				<McqAnswerChoices
					options={currentQuestion?.options ?? []}
					{selectedOption}
					{hasCheckedAnswer}
					{checkedSelection}
					correctAnswer={currentQuestion?.correctAnswer}
					onSelect={handleOptionSelect}
				/>
			{/if}

			{#if showUtilityActions && !hasCheckedAnswer}
				<div class="flex flex-wrap gap-2">
					<Button variant="ghost" size="sm" onclick={handleSkipQuestion} disabled={isLoading}
						>{skipLabel}</Button
					>
					<Button variant="ghost" size="sm" onclick={handleNotLearnedQuestion} disabled={isLoading}>
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
					<p class="text-sm text-muted-foreground">{feedbackMessage}</p>
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
				{#if hasCheckedAnswer && currentQuestion?.explanation}
					<Button variant="outline" onclick={() => (showExplanation = true)}>
						{showExplanationLabel}
					</Button>
				{/if}
				<Button
					variant="outline"
					onclick={handleNextQuestion}
					disabled={isLoading || !hasCheckedAnswer}
				>
					{nextLabel}
				</Button>
				{#if !hasCheckedAnswer}
					<Button disabled={!selectedOption} onclick={handleCheckAnswer}>{checkLabel}</Button>
				{/if}
			</div>
		</Card.Footer>

		{#if showExplanation && currentQuestion?.explanation}
			<div
				class="absolute inset-0 z-20 flex items-center justify-center bg-background/65 p-4 backdrop-blur-[1px]"
			>
				<div
					class="max-h-[85%] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl"
				>
					<h3 class="text-lg font-semibold">
						{checkedSelection === currentQuestion?.correctAnswer
							? 'Correct!'
							: 'Review Explanation'}
					</h3>
					{#if currentQuestion?.correctAnswer}
						<p class="mt-2 text-sm text-muted-foreground">
							Correct answer:
							<span class="font-semibold text-foreground">{currentQuestion?.correctAnswer}</span>
						</p>
					{/if}
					<RichText
						text={currentQuestion?.explanation ?? ''}
						class="mt-4 text-sm leading-6 text-foreground/90"
					/>
					<div class="mt-5 flex justify-end">
						<Button variant="outline" onclick={() => (showExplanation = false)}>Close</Button>
					</div>
				</div>
			</div>
		{/if}
	{/snippet}

	<!-- Normal card (kept in the DOM to preserve layout space; hidden while expanded) -->
	<Card.Root
		class={cn(
			'relative overflow-hidden border-border/70 bg-card/95 shadow-sm backdrop-blur-sm',
			isExpanded ? 'pointer-events-none invisible' : className
		)}
		aria-hidden={isExpanded}
	>
		{@render cardInner(false)}
	</Card.Root>

	<!-- Fullscreen overlay - scales in/out smoothly -->
	{#if isExpanded}
		<div
			use:portalToBody
			class="fixed inset-0 z-50 flex flex-col"
			transition:scale={{ duration: 240, start: 0.97, opacity: 0, easing: quintOut }}
		>
			<Card.Root
				class="relative flex h-full flex-col overflow-hidden rounded-none border-0 bg-card/98 shadow-2xl backdrop-blur-sm"
			>
				{@render cardInner(true)}
			</Card.Root>
		</div>
	{/if}

	{#if currentQuestion}
		{#key currentQuestion.questionId ?? currentQuestion.prompt}
			<TutorWidget
				question={currentQuestion.prompt}
				answer={currentQuestion.correctAnswer ?? ''}
				explanation={currentQuestion.explanation ?? ''}
				apClass={selectedClass}
				unit={tutorUnitLabel}
				answerChoices={tutorAnswerChoices}
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
		{customTopic}
	/>
{/if}
