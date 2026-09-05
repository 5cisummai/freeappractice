<script lang="ts">
	import type {
		AddTextAnnotationInput,
		ExamNavItem,
		GeneratedQuestion,
		TextAnnotation
	} from '$lib/question-bank/mcq/types';
	import { IsMobile } from '$lib/hooks/is-mobile.svelte.js';
	import AnnotatableRichText from '$lib/components/questions/annotatable-rich-text.svelte';
	import McqAnswerChoices from '$lib/components/questions/mcq-answer-choices.svelte';
	import ExamfigDiagram from '$lib/components/questions/examfig-diagram.svelte';
	import { portalToBody } from '$lib/components/questions/portal-to-body.svelte.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import * as Resizable from '$lib/components/ui/resizable/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { Toggle } from '$lib/components/ui/toggle/index.js';
	import { cn } from '$lib/utils.js';
	import BookmarkIcon from '@tabler/icons-svelte/icons/bookmark';
	import BookmarkFilledIcon from '@tabler/icons-svelte/icons/bookmark-filled';
	import CheckIcon from '@tabler/icons-svelte/icons/check';
	import ChevronUpIcon from '@tabler/icons-svelte/icons/chevron-up';
	import MapPinIcon from '@tabler/icons-svelte/icons/map-pin';
	import StrikethroughIcon from '@tabler/icons-svelte/icons/strikethrough';
	import XIcon from '@tabler/icons-svelte/icons/x';

	interface FullQuestionProps {
		question: GeneratedQuestion;
		questionNumber: string | number;
		totalQuestions?: number;
		title?: string;
		selectedOption?: string | null;
		flagged?: boolean;
		struckOptionIds?: ReadonlySet<string> | string[];
		textAnnotations?: TextAnnotation[];
		stimulusScrollTop?: number;
		onStimulusScroll?: (scrollTop: number) => void;
		remainingMs?: number | null;
		elapsedMs?: number;
		navItems?: ExamNavItem[];
		isLastQuestion?: boolean;
		nextDisabled?: boolean;
		prevDisabled?: boolean;
		hasCheckedAnswer?: boolean;
		checkedSelection?: string | null;
		correctAnswer?: string;
		showFeedback?: boolean;
		checkLabel?: string;
		nextActionLabel?: string;
		stage?: 'question' | 'review';
		reviewTitle?: string;
		submitDisabled?: boolean;
		class?: string;
		onSelect?: (optionId: string | null) => void;
		onToggleFlag?: () => void;
		onToggleStrike?: (optionId: string) => void;
		onAddTextAnnotation?: (input: AddTextAnnotationInput) => void;
		onRemoveTextAnnotation?: (annotationId: string) => void;
		onPrev?: () => void;
		onNext?: () => void;
		onCheck?: () => void;
		onGoTo?: (index: number) => void;
		onEnterReview?: () => void;
		reviewPageDisabled?: boolean;
		onSubmit?: () => void;
		onClose?: () => void;
	}

	const FIVE_MIN_MS = 5 * 60 * 1000;

	let {
		question,
		questionNumber,
		totalQuestions,
		title,
		selectedOption = null,
		flagged = $bindable(false),
		struckOptionIds,
		textAnnotations = [],
		stimulusScrollTop = 0,
		onStimulusScroll,
		remainingMs = null,
		elapsedMs = 0,
		navItems,
		isLastQuestion = false,
		nextDisabled = false,
		prevDisabled = false,
		hasCheckedAnswer = false,
		checkedSelection = null,
		correctAnswer,
		showFeedback = false,
		checkLabel = 'Check Answer',
		nextActionLabel,
		stage = 'question',
		reviewTitle,
		submitDisabled = false,
		class: className = '',
		onSelect,
		onToggleFlag,
		onToggleStrike,
		onAddTextAnnotation,
		onRemoveTextAnnotation,
		onPrev,
		onNext,
		onCheck,
		onGoTo,
		onEnterReview,
		reviewPageDisabled = false,
		onSubmit,
		onClose
	}: FullQuestionProps = $props();

	let menuOpen = $state(false);
	let eliminatorActive = $state(false);
	let stimulusScrollNode = $state<HTMLElement | null>(null);
	const isMobile = new IsMobile();
	const isReviewStage = $derived(stage === 'review');
	const showSplit = $derived(
		!isReviewStage &&
		!isMobile.current &&
		Boolean(question.hasStimulus && (question.leftPanel || question.diagramSpec))
	);
	const displayNumber = $derived(Number(questionNumber));
	const currentIndex = $derived(
		Number.isFinite(displayNumber) ? Math.max(0, displayNumber - 1) : 0
	);

	const progressLabel = $derived(
		totalQuestions != null
			? `Question ${questionNumber} of ${totalQuestions}`
			: `Question ${questionNumber}`
	);

	const timerMs = $derived(remainingMs != null ? remainingMs : (elapsedMs ?? 0));
	const timerUrgent = $derived(remainingMs != null && remainingMs <= FIVE_MIN_MS);
	const timerLabel = $derived(formatTimer(timerMs));
	const hasTimer = $derived(remainingMs != null || Boolean(elapsedMs));
	const showCheckAction = $derived(Boolean(onCheck) && !hasCheckedAnswer);
	const nextLabel = $derived(nextActionLabel ?? (isLastQuestion ? 'Review' : 'Next'));
	const reviewHeading = $derived(reviewTitle ?? title ?? 'Review your answers');
	const canUseEliminator = $derived(Boolean(onToggleStrike) && !hasCheckedAnswer);
	const canAnnotate = $derived(Boolean(onAddTextAnnotation) && !hasCheckedAnswer);

	$effect(() => {
		if (stimulusScrollNode) stimulusScrollNode.scrollTop = stimulusScrollTop;
	});

	const menuItems = $derived.by((): ExamNavItem[] => {
		if (navItems?.length) return navItems;
		if (totalQuestions != null && totalQuestions > 0) {
			return Array.from({ length: totalQuestions }, (_, index) => ({
				index,
				loaded: true,
				answered: false,
				flagged: false,
				failed: false
			}));
		}
		return [];
	});

	function formatTimer(ms: number): string {
		const totalSeconds = Math.max(0, Math.floor(ms / 1000));
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
	}

	function toggleFlag(): void {
		flagged = !flagged;
		onToggleFlag?.();
	}

	function goTo(index: number): void {
		onGoTo?.(index);
	}

	function enterReviewPage(): void {
		menuOpen = false;
		onEnterReview?.();
	}

	function trapFocus(node: HTMLElement): () => void {
		const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const getFocusable = () =>
			Array.from(
				node.querySelectorAll<HTMLElement>(
					'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
				)
			).filter((element) => !element.hasAttribute('disabled') && element.tabIndex !== -1);

		function handleKeydown(event: KeyboardEvent): void {
			if (event.key === 'Escape') {
				event.preventDefault();
				onClose?.();
				return;
			}
			if (event.key !== 'Tab') return;

			const focusable = getFocusable();
			if (focusable.length === 0) {
				event.preventDefault();
				node.focus();
				return;
			}

			const first = focusable[0];
			const last = focusable.at(-1);
			const active = document.activeElement;
			if (event.shiftKey && (active === first || active === node)) {
				event.preventDefault();
				last?.focus();
			} else if (!event.shiftKey && active === last) {
				event.preventDefault();
				first.focus();
			}
		}

		node.addEventListener('keydown', handleKeydown);
		return () => {
			node.removeEventListener('keydown', handleKeydown);
			if (opener?.isConnected) {
				requestAnimationFrame(() => opener.focus());
			}
		};
	}

	function focusQuestionOnChange(questionKey: string) {
		void questionKey;
		return (node: HTMLElement) => {
			eliminatorActive = false;
			const frame = requestAnimationFrame(() => node.focus());
			return () => cancelAnimationFrame(frame);
		};
	}
</script>

{#snippet stimulusContent()}
	{#if question.leftPanel}
		<p class="mb-3 text-sm font-semibold text-foreground">
			{question.leftPanel.title ?? 'Passage'}
		</p>
		<div class="space-y-4 font-serif text-sm leading-6 text-foreground/90">
			{#each question.leftPanel.content as paragraph, i (i)}
				<AnnotatableRichText
					text={paragraph}
					blocks
					target={{ kind: 'stimulus', paragraphIndex: i }}
					annotations={textAnnotations}
					disabled={!canAnnotate}
					onAddAnnotation={onAddTextAnnotation}
					onRemoveAnnotation={onRemoveTextAnnotation}
					class="max-w-none"
				/>
			{/each}
		</div>
	{/if}
{/snippet}

{#snippet stimulusPane()}
	{@render stimulusContent()}
	{#if question.diagramSpec}
		<div class="mt-4">
			<ExamfigDiagram spec={question.diagramSpec} />
		</div>
	{/if}
{/snippet}

{#snippet questionChrome()}
	<div
		class="mb-2 flex items-center gap-2 rounded-sm border-b border-dashed border-border bg-muted"
	>
		<span
			class="flex size-7 shrink-0 items-center justify-center rounded-[3px] bg-foreground font-sans text-xs font-semibold text-background tabular-nums"
			aria-hidden="true"
		>
			{questionNumber}
		</span>

		<div class="ms-auto flex items-center gap-2">
			{#if onToggleFlag}
				<Button
					variant={flagged ? 'secondary' : 'ghost'}
					size="sm"
					aria-pressed={flagged}
					onclick={toggleFlag}
				>
					{#if flagged}
						<BookmarkFilledIcon class="text-amber-600 dark:text-amber-400" />
					{:else}
						<BookmarkIcon />
					{/if}
					Mark for Review
				</Button>
			{/if}

			{#if canUseEliminator}
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<Toggle
								{...props}
								bind:pressed={eliminatorActive}
								variant="outline"
								size="sm"
								aria-label="Answer eliminator"
							>
								<StrikethroughIcon />
							</Toggle>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content>
						{eliminatorActive ? 'Eliminator on — click choices to cross out' : 'Answer eliminator'}
					</Tooltip.Content>
				</Tooltip.Root>
			{/if}
		</div>
	</div>
{/snippet}

{#snippet questionPane()}
	{@render questionChrome()}

	<div class="mt-4 space-y-4">
		{#if !showSplit && question.leftPanel}
			<div class="space-y-4 font-serif text-sm leading-6 text-foreground/90">
				{@render stimulusContent()}
			</div>
		{/if}
		{#if question.rightPanel}
			{#if question.rightPanel.title}
				<p class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
					{question.rightPanel.title}
				</p>
			{/if}
			<div class="space-y-3 font-serif text-sm leading-6 text-foreground">
				{#each question.rightPanel.content as paragraph, i (i)}
					<AnnotatableRichText
						text={paragraph}
						blocks
						target={{ kind: 'prompt', paragraphIndex: i }}
						annotations={textAnnotations}
						disabled={!canAnnotate}
						onAddAnnotation={onAddTextAnnotation}
						onRemoveAnnotation={onRemoveTextAnnotation}
						class="max-w-none"
					/>
				{/each}
			</div>
		{:else if question.prompt}
			<div class="font-serif text-sm leading-6 text-foreground">
				<AnnotatableRichText
					text={question.prompt}
					blocks
					target={{ kind: 'prompt', paragraphIndex: 0 }}
					annotations={textAnnotations}
					disabled={!canAnnotate}
					onAddAnnotation={onAddTextAnnotation}
					onRemoveAnnotation={onRemoveTextAnnotation}
					class="max-w-none"
				/>
			</div>
		{/if}

		{#if question.diagramSpec && !showSplit}
			<ExamfigDiagram spec={question.diagramSpec} />
		{/if}
	</div>

	<div class="mt-8">
		<McqAnswerChoices
			variant="exam"
			options={question.options}
			{selectedOption}
			{struckOptionIds}
			{textAnnotations}
			{onAddTextAnnotation}
			{onRemoveTextAnnotation}
			annotationsDisabled={!canAnnotate}
			{hasCheckedAnswer}
			{checkedSelection}
			{correctAnswer}
			{showFeedback}
			{eliminatorActive}
			onSelect={(id) => onSelect?.(id)}
			{onToggleStrike}
		/>
	</div>

	{#if showCheckAction}
		<div class="mt-4 flex justify-end">
			<Button
				variant="secondary"
				size="sm"
				disabled={!selectedOption}
				onclick={() => onCheck?.()}
				class="gap-1.5"
			>
				<CheckIcon class="size-3.5" />
				{checkLabel}
			</Button>
		</div>
	{/if}
{/snippet}

{#snippet bluebookLegend()}
	<div
		class="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-b border-border pb-4 text-sm text-foreground"
	>
		<span class="inline-flex items-center gap-2">
			<MapPinIcon class="size-4" aria-hidden="true" />
			Current
		</span>
		<span class="inline-flex items-center gap-2">
			<span
				class="inline-flex size-4 rounded-sm border border-dashed border-foreground bg-background"
				aria-hidden="true"
			></span>
			Unanswered
		</span>
		<span class="inline-flex items-center gap-2">
			<BookmarkFilledIcon class="size-4 text-red-600 dark:text-red-500" aria-hidden="true" />
			For Review
		</span>
	</div>
{/snippet}

{#snippet bluebookNavGrid()}
	<div class="grid grid-cols-5 gap-3 sm:grid-cols-8 lg:grid-cols-10">
		{#each menuItems as item (item.index)}
			<div class="relative flex justify-center pt-5">
				{#if item.index === currentIndex}
					<MapPinIcon
						class="absolute top-0 left-1/2 size-4 -translate-x-1/2 text-foreground"
						aria-hidden="true"
					/>
				{/if}
				<button
					type="button"
					class={cn(
						'relative flex size-10 items-center justify-center rounded-sm text-sm font-semibold tabular-nums transition-colors',
						item.answered
							? 'bg-blue-700 text-white hover:bg-blue-800'
							: 'border border-dashed border-foreground bg-background text-blue-700 hover:bg-muted/40',
						!item.loaded && 'cursor-not-allowed opacity-50'
					)}
					disabled={!item.loaded || !onGoTo}
					aria-current={item.index === currentIndex ? 'true' : undefined}
					aria-label={`Question ${item.index + 1}${item.answered ? ', answered' : ', unanswered'}${item.flagged ? ', marked for review' : ''}`}
					onclick={() => goTo(item.index)}
				>
					{item.index + 1}
					{#if item.flagged}
						<BookmarkFilledIcon
							class="absolute -top-1.5 -right-1.5 size-3.5 text-red-600 dark:text-red-500"
							aria-hidden="true"
						/>
					{/if}
				</button>
			</div>
		{/each}
	</div>
{/snippet}

{#snippet reviewPane()}
	<div class="space-y-6">
		<div class="space-y-4 border-b border-border pb-6 text-center">
			<h2 class="text-lg font-semibold text-foreground sm:text-xl">{reviewHeading}</h2>
		</div>

		{@render bluebookLegend()}
		{@render bluebookNavGrid()}
	</div>
{/snippet}

{#snippet questionMenuPopover()}
	<div class="space-y-4">
		{@render bluebookLegend()}
		{@render bluebookNavGrid()}
	</div>
{/snippet}

<Tooltip.Provider>
	<div
		{@attach portalToBody()}
		{@attach trapFocus}
		{@attach focusQuestionOnChange(question.questionId ?? question.prompt)}
		class={cn(
			'fixed inset-0 z-40 flex h-dvh w-screen flex-col bg-background text-foreground',
			className
		)}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		aria-label={isReviewStage ? 'Review your answers' : (title ?? `Question ${questionNumber}`)}
	>
		<header
			class="grid min-h-14 shrink-0 grid-cols-3 items-center border-b border-border px-3 py-2 sm:px-4"
		>
			<p class="min-w-0 truncate text-sm font-medium text-foreground">
				{title ?? 'Quiz'}
			</p>

			<div class="flex items-center justify-center">
				{#if hasTimer}
					<span
						class={cn(
							'text-lg leading-none font-semibold tabular-nums',
							timerUrgent ? 'text-destructive' : 'text-foreground'
						)}
						aria-live="polite"
					>
						{timerLabel}
					</span>
				{/if}
			</div>

			<div class="flex items-center justify-end">
				{#if onClose}
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label="Leave quiz"
						onclick={() => onClose?.()}
					>
						<XIcon class="size-4" />
					</Button>
				{/if}
			</div>
		</header>

		<main class="min-h-0 flex-1 overflow-hidden">
			{#if isReviewStage}
				<div class="h-full overflow-y-auto">
					<div class="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
						{@render reviewPane()}
					</div>
				</div>
			{:else if showSplit}
				<Resizable.PaneGroup direction="horizontal" class="h-full">
					<Resizable.Pane defaultSize={50} minSize={28} class="min-h-0">
						<div
							bind:this={stimulusScrollNode}
							onscroll={(event) => onStimulusScroll?.(event.currentTarget.scrollTop)}
							class="h-full overflow-y-auto px-4 py-4 sm:px-5"
						>
							{@render stimulusPane()}
						</div>
					</Resizable.Pane>
					<Resizable.Handle withHandle />
					<Resizable.Pane defaultSize={50} minSize={28} class="min-h-0">
						<div class="h-full overflow-y-auto border-l border-border px-4 py-4 sm:px-5">
							{@render questionPane()}
						</div>
					</Resizable.Pane>
				</Resizable.PaneGroup>
			{:else}
				<div class="h-full overflow-y-auto">
					<div class="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6">
						{@render questionPane()}
					</div>
				</div>
			{/if}
		</main>

		<footer
			class="relative flex h-12 shrink-0 items-center justify-end gap-2 border-t border-border bg-background px-3 sm:px-4"
		>
			<div class="absolute inset-x-0 z-10 flex justify-center">
				{#if menuItems.length > 0 && onGoTo}
					<Popover.Root bind:open={menuOpen}>
						<Popover.Trigger>
							{#snippet child({ props })}
								<Button variant="secondary" size="sm" {...props}>
									<span class="tabular-nums">
										{isReviewStage ? 'Review' : progressLabel}
									</span>
									<ChevronUpIcon class="size-4 opacity-70" />
								</Button>
							{/snippet}
						</Popover.Trigger>
						<Popover.Content
							align="center"
							side="top"
							sideOffset={10}
							class="max-h-[calc(100vh-2rem)] w-[min(42rem,calc(100vw-2rem))] gap-0 overflow-y-auto p-0"
						>
							<Popover.Header class="relative border-none px-4 py-3 text-center">
								<Popover.Title class="text-base font-semibold">
									{title ?? 'Quiz'}
								</Popover.Title>
								<Popover.Close
									class="absolute top-3 right-3 rounded-sm text-muted-foreground transition-colors hover:text-foreground"
								>
									<XIcon class="size-4" />
									<span class="sr-only">Close question menu</span>
								</Popover.Close>
							</Popover.Header>
							<div class="px-4 py-4">
								{@render questionMenuPopover()}
							</div>
							{#if onEnterReview && !isReviewStage}
								<div class="flex justify-center px-4 py-4">
									<Button
										variant="outline"
										class="rounded-full border-blue-700 px-6 text-blue-700 hover:bg-blue-50 hover:text-blue-800 dark:hover:bg-blue-950/40"
										disabled={reviewPageDisabled}
										onclick={enterReviewPage}
									>
										Go to Review Page
									</Button>
								</div>
							{/if}
						</Popover.Content>
					</Popover.Root>
				{:else}
					<span class="text-sm text-muted-foreground tabular-nums">
						{isReviewStage ? 'Review' : progressLabel}
					</span>
				{/if}
			</div>

			<div class="relative z-10 flex items-center gap-2">
				{#if isReviewStage}
					<Button
						variant="default"
						size="sm"
						disabled={submitDisabled || !onSubmit}
						onclick={() => onSubmit?.()}
					>
						Submit quiz
					</Button>
				{:else}
					{#if onPrev}
						<Button variant="default" size="sm" disabled={prevDisabled} onclick={() => onPrev?.()}>
							Back
						</Button>
					{/if}
					<Button
						variant="default"
						size="sm"
						disabled={nextDisabled || !onNext}
						onclick={() => onNext?.()}
					>
						{nextLabel}
					</Button>
				{/if}
			</div>
		</footer>
	</div>
</Tooltip.Provider>
