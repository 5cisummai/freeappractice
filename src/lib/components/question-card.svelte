<script lang="ts" module>
	export type QuestionOption = {
		id: string;
		label: string;
		text: string;
	};

	export type QuestionPanel = {
		title: string;
		content: string[];
	};

	export type AnswerResult = {
		questionId?: string;
		questionNumber: string;
		selectedAnswer: string;
		correctAnswer: string;
		isCorrect: boolean;
		timeTakenMs: number;
	};

	export type BugReportContext = {
		questionId?: string;
		questionNumber: string;
		selectedClass?: string;
		selectedUnit?: string;
		prompt?: string;
		correctAnswer?: string;
		hasStimulus: boolean;
	};

	export type GeneratedQuestion = {
		questionId?: string;
		prompt: string;
		options: QuestionOption[];
		correctAnswer?: string;
		explanation?: string;
		leftPanel?: QuestionPanel;
		rightPanel?: QuestionPanel;
		hasStimulus: boolean;
	};

	export type FRQPart = {
		label: string;
		question: string;
		pointValue: number;
		scoringCriteria: string;
		modelAnswer: string;
	};

	export type FRQQuestion = {
		questionId?: string;
		prompt: string;
		context?: string | null;
		parts: FRQPart[];
		totalPoints: number;
	};

	export type FRQPartGrade = {
		label: string;
		pointsEarned: number;
		pointsAvailable: number;
		score: number;
		feedback: string;
	};

	export type FRQGrade = {
		parts: FRQPartGrade[];
		totalScore: number;
		overallFeedback: string;
	};

	export type FRQAnswerResult = {
		questionId?: string;
		questionNumber: string;
		aiScore: number;
		pointsEarned: number;
		totalPoints: number;
		timeTakenMs: number;
	};

	export type QuestionCardProps = {
		class?: string;
		mode?: 'mcq' | 'frq';
		subject?: string;
		questionNumber?: string;
		selectedClass?: string;
		selectedUnit?: string;
		requestVersion?: number;
		selectedOption?: string | null;
		autoDetectLongQuestion?: boolean;
		longQuestionThresholdChars?: number;
		autoShowExplanation?: boolean;
		checkLabel?: string;
		nextLabel?: string;
		showExplanationLabel?: string;
		showUtilityActions?: boolean;
		skipLabel?: string;
		notLearnedLabel?: string;
		reportBugLabel?: string;
		onCheckAnswer?: (selectedOption: string | null) => void;
		onSkip?: () => void;
		onNotLearned?: () => void;
		onReportBug?: (context: BugReportContext) => void;
		onAnswered?: (result: AnswerResult) => void;
		onFRQAnswered?: (result: FRQAnswerResult) => void;
	};
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { scale } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import BugReportDialog from '$lib/components/bug-report-dialog.svelte';
	import QuestionCardSkeleton from '$lib/components/question-card-skeleton.svelte';
	import RichText from '$lib/components/rich-text.svelte';
	import * as Resizable from '$lib/components/ui/resizable/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { cn } from '$lib/utils.js';
	import { apiFetch } from '$lib/client/auth.svelte.js';
	import Maximize2Icon from '@lucide/svelte/icons/maximize-2';
	import Minimize2Icon from '@lucide/svelte/icons/minimize-2';
	import TutorWidget from '$lib/components/tutor/tutor-widget.svelte';

	let {
		class: className,
		mode = 'mcq',
		questionNumber = '',
		selectedClass = '',
		selectedUnit = '',
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
		onAnswered,
		onFRQAnswered
	}: QuestionCardProps = $props();

	let promptElement = $state<HTMLDivElement | null>(null);
	let isLongQuestion = $state(false);
	let hasCheckedAnswer = $state(false);
	let isExpanded = $state(false);
	let checkedSelection = $state<string | null>(null);
	let answerResult = $state<AnswerResult | null>(null);
	let showExplanation = $state(false);
	let startedAtMs = $state(Date.now());
	let isLoading = $state(false);
	let questionCount = $state(0);
	let statusMessage = $state('Choose the best answer and then check your response.');
	let currentQuestion = $state<GeneratedQuestion | null>(null);
	let bugReportOpen = $state(false);
	let bugReportContext = $state<BugReportContext | null>(null);
	let isMobileViewport = $state(false);

	// FRQ state
	let frqQuestion = $state<FRQQuestion | null>(null);
	let frqResponses = $state<Record<string, string>>({});
	let frqGrade = $state<FRQGrade | null>(null);
	let isGrading = $state(false);
	let hasSubmitted = $state(false);

	const effectiveQuestionNumber = $derived(questionNumber || `${questionCount}`);
	const effectiveTwoColumn = $derived(
		!isMobileViewport && (currentQuestion?.hasStimulus || (autoDetectLongQuestion && isLongQuestion))
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

	// FRQ derived state
	const frqHasContext = $derived(Boolean(frqQuestion?.context?.trim()));
	const allPartsAnswered = $derived.by(() => {
		if (!frqQuestion) return false;
		return frqQuestion.parts.every((p) => (frqResponses[p.label] ?? '').trim().length > 0);
	});

	function getScoreColor(score: number): string {
		if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
		if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
		return 'text-red-600 dark:text-red-400';
	}

	function getScoreBg(score: number): string {
		if (score >= 80) return 'border-emerald-500/60 bg-emerald-500/10';
		if (score >= 60) return 'border-yellow-500/60 bg-yellow-500/10';
		return 'border-red-500/60 bg-red-500/10';
	}

	function parseParagraphs(value: unknown): string[] {
		if (typeof value !== 'string') return [];
		const lines = value.split('\n');
		const segments: string[] = [];
		let current: string[] = [];
		let inFence = false;
		let fenceChar = '';
		let fenceLen = 0;
		for (const line of lines) {
			if (!inFence) {
				const m = line.match(/^[ \t]*(`{3,}|~{3,})/);
				if (m) {
					inFence = true;
					fenceChar = m[1][0];
					fenceLen = m[1].length;
					current.push(line);
				} else if (line.trim() === '' && current.length > 0) {
					segments.push(current.join('\n').trim());
					current = [];
				} else {
					current.push(line);
				}
			} else {
				const closeRe = new RegExp(`^[ \\t]*\\${fenceChar}{${fenceLen},}[ \\t]*$`);
				current.push(line);
				if (closeRe.test(line)) inFence = false;
			}
		}
		if (current.length > 0) segments.push(current.join('\n').trim());
		return segments.filter(Boolean);
	}

	function extractCorrectLetter(value: unknown): string | undefined {
		if (typeof value !== 'string') return undefined;
		const match = value.toUpperCase().match(/[A-D]/);
		return match?.[0];
	}

	function normalizeOptions(value: unknown): QuestionOption[] {
		if (Array.isArray(value)) {
			return value
				.slice(0, 4)
				.map((entry, index) => {
					if (typeof entry === 'string') {
						const letter = String.fromCharCode(65 + index);
						return { id: letter, label: letter, text: entry };
					}
					if (entry && typeof entry === 'object') {
						const obj = entry as Record<string, unknown>;
						const id = String(obj.id ?? obj.label ?? String.fromCharCode(65 + index)).toUpperCase();
						const label = id;
						const text = String(obj.text ?? obj.value ?? '');
						return { id, label, text };
					}
					return null;
				})
				.filter((entry): entry is QuestionOption => Boolean(entry && entry.text));
		}

		if (!value || typeof value !== 'object') return [];

		const obj = value as Record<string, unknown>;
		return ['A', 'B', 'C', 'D']
			.map((letter) => {
				const text = obj[`option${letter}`];
				if (typeof text !== 'string' || !text.trim()) return null;
				return { id: letter, label: letter, text: text.trim() };
			})
			.filter((entry): entry is QuestionOption => Boolean(entry));
	}

	function normalizeQuestionPayload(
		payload: unknown,
		questionIdFromApi?: string
	): GeneratedQuestion | null {
		if (!payload || typeof payload !== 'object') return null;

		const obj = payload as Record<string, unknown>;
		const prompt = String(obj.question ?? obj.prompt ?? '').trim();
		if (!prompt) return null;

		const optionsFromObject = normalizeOptions(obj);
		const options =
			optionsFromObject.length > 0 ? optionsFromObject : normalizeOptions(obj.options);
		if (options.length < 2) return null;

		const stimulus = String(obj.stimulus ?? obj.passage ?? obj.context ?? '').trim();
		const hasStimulus = stimulus.length > 0;

		return {
			questionId: String(obj.questionId ?? questionIdFromApi ?? '').trim() || undefined,
			prompt,
			options,
			correctAnswer: extractCorrectLetter(obj.correctAnswer ?? obj.answer),
			explanation: String(obj.explanation ?? obj.rationale ?? '').trim() || undefined,
			leftPanel: hasStimulus
				? { title: 'Stimulus', content: parseParagraphs(stimulus) }
				: undefined,
			rightPanel: hasStimulus ? { title: 'Prompt', content: parseParagraphs(prompt) } : undefined,
			hasStimulus
		};
	}

	async function requestQuestion(
		className: string,
		unit: string
	): Promise<Record<string, unknown>> {
		const response = await apiFetch('/api/question', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ className, unit })
		});

		return (await response.json()) as Record<string, unknown>;
	}

	function detectLongQuestionLayout(): void {
		const textLength = currentQuestion?.prompt.length ?? 0;
		const hasCodeBlock = /```|\n\s{2,}|<code/i.test(currentQuestion?.prompt ?? '');
		const questionHeight = promptElement?.scrollHeight ?? 0;
		const threshold = Math.min(window.innerHeight * 0.7, 600);
		isLongQuestion =
			textLength > longQuestionThresholdChars || hasCodeBlock || questionHeight > threshold;
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

	async function loadQuestion(reason?: 'skip' | 'not-learned' | 'next'): Promise<void> {
		if (!selectedClass) {
			statusMessage = 'Please choose a class before requesting a question.';
			return;
		}

		isLoading = true;

		if (reason === 'skip') statusMessage = 'Skipped current question.';
		else if (reason === 'not-learned') statusMessage = "Marked as: I haven't learned this yet.";
		else statusMessage = 'Loading question...';

		try {
			const response = await requestQuestion(selectedClass, selectedUnit);

			if (typeof response.error === 'string' && response.error.trim()) {
				throw new Error(response.error);
			}

			let payload: unknown = response;
			if (typeof response.answer === 'string') {
				let raw = response.answer.trim();
				if (raw.startsWith('```')) {
					raw = raw.replace(/```json|```/g, '').trim();
				}
				payload = JSON.parse(raw);
			}

			const normalized = normalizeQuestionPayload(payload, String(response.questionId ?? ''));
			if (!normalized) {
				throw new Error('Question API response was missing required fields.');
			}

			currentQuestion = normalized;
			questionCount += 1;
			statusMessage = 'Choose the best answer and then check your response.';
			resetInteractionState(true);
			saveToStorage();
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
		saveToStorage();

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
			prompt: currentQuestion?.prompt,
			correctAnswer: currentQuestion?.correctAnswer,
			hasStimulus: Boolean(currentQuestion?.hasStimulus)
		};
		onReportBug?.(ctx);
		bugReportContext = ctx;
		bugReportOpen = true;
	}

	function optionButtonClasses(optionId: string): string {
		if (!hasCheckedAnswer) {
			return selectedOption === optionId
				? 'border-primary/70 bg-primary/8'
				: 'border-border/70 bg-background hover:bg-muted/40';
		}
		if (currentQuestion?.correctAnswer && optionId === currentQuestion.correctAnswer) {
			return 'border-emerald-500/70 bg-emerald-500/10';
		}
		if (checkedSelection === optionId && checkedSelection !== currentQuestion?.correctAnswer) {
			return 'border-red-500/70 bg-red-500/10';
		}
		return 'border-border/60 bg-background/60 opacity-80';
	}

	function optionBadgeClasses(optionId: string): string {
		if (!hasCheckedAnswer) {
			return selectedOption === optionId
				? 'border-primary bg-primary text-primary-foreground'
				: 'border-border bg-muted/50 text-muted-foreground';
		}
		if (currentQuestion?.correctAnswer && optionId === currentQuestion.correctAnswer) {
			return 'border-emerald-500 bg-emerald-500 text-white';
		}
		if (checkedSelection === optionId && checkedSelection !== currentQuestion?.correctAnswer) {
			return 'border-red-500 bg-red-500 text-white';
		}
		return 'border-border bg-muted/40 text-muted-foreground';
	}

	// --- FRQ functions ---

	function resetFRQState(): void {
		frqQuestion = null;
		frqGrade = null;
		frqResponses = {};
		hasSubmitted = false;
		isGrading = false;
		startedAtMs = Date.now();
	}

	async function loadFRQQuestion(): Promise<void> {
		if (!selectedClass) {
			statusMessage = 'Please choose a class before requesting a question.';
			return;
		}

		isLoading = true;
		statusMessage = 'Loading question...';
		resetFRQState();

		try {
			const response = await apiFetch('/api/question/frq', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ className: selectedClass, unit: selectedUnit })
			});

			if (!response.ok) {
				const err = (await response.json().catch(() => ({}))) as Record<string, unknown>;
				throw new Error(typeof err.error === 'string' ? err.error : 'Failed to load question');
			}

			const data = (await response.json()) as {
				question: { prompt: string; context?: string; parts: FRQPart[]; totalPoints: number };
				questionId?: string;
			};

			frqQuestion = {
				questionId: data.questionId,
				prompt: data.question.prompt,
				context: data.question.context ?? null,
				parts: data.question.parts,
				totalPoints: data.question.totalPoints
			};
			frqResponses = Object.fromEntries(data.question.parts.map((p) => [p.label, '']));
			questionCount += 1;
			statusMessage = 'Write your response for each part, then submit.';
			saveToStorage();
		} catch (error) {
			statusMessage = error instanceof Error ? error.message : 'Could not load question.';
		} finally {
			isLoading = false;
		}
	}

	async function handleFRQSubmit(): Promise<void> {
		if (!frqQuestion || !allPartsAnswered || isGrading) return;

		isGrading = true;
		statusMessage = 'Grading your response...';

		try {
			const response = await apiFetch('/api/question/frq/grade', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					className: selectedClass,
					unit: selectedUnit,
					parts: frqQuestion.parts,
					responses: frqResponses
				})
			});

			if (!response.ok) {
				const err = (await response.json().catch(() => ({}))) as Record<string, unknown>;
				throw new Error(typeof err.error === 'string' ? err.error : 'Failed to grade response');
			}

			const data = (await response.json()) as { grade: FRQGrade };
			frqGrade = data.grade;
			hasSubmitted = true;
			statusMessage = `Score: ${frqGrade.totalScore}/100`;
			saveToStorage();

			const earnedPoints = frqGrade.parts.reduce((sum, p) => sum + p.pointsEarned, 0);
			const timeTakenMs = Date.now() - startedAtMs;

			onFRQAnswered?.({
				questionId: frqQuestion.questionId,
				questionNumber: effectiveQuestionNumber,
				aiScore: frqGrade.totalScore,
				pointsEarned: earnedPoints,
				totalPoints: frqQuestion.totalPoints,
				timeTakenMs
			});
		} catch (error) {
			statusMessage = error instanceof Error ? error.message : 'Could not grade response.';
		} finally {
			isGrading = false;
		}
	}

	async function handleFRQNext(): Promise<void> {
		await loadFRQQuestion();
	}

	// ── localStorage persistence ─────────────────────────────

	function getStorageKey(): string {
		return `practice_q_${mode}_${selectedClass}_${selectedUnit}`;
	}

	function saveToStorage(): void {
		if (typeof localStorage === 'undefined') return;
		const key = getStorageKey();
		try {
			if (mode === 'mcq') {
				if (!currentQuestion) {
					localStorage.removeItem(key);
					return;
				}
				localStorage.setItem(
					key,
					JSON.stringify({
						currentQuestion,
						hasCheckedAnswer,
						checkedSelection,
						answerResult,
						selectedOption,
						showExplanation,
						statusMessage,
						startedAtMs,
						questionCount
					})
				);
			} else {
				if (!frqQuestion) {
					localStorage.removeItem(key);
					return;
				}
				localStorage.setItem(
					key,
					JSON.stringify({
						frqQuestion,
						frqResponses,
						frqGrade,
						hasSubmitted,
						statusMessage,
						startedAtMs,
						questionCount
					})
				);
			}
		} catch {
			/* non-critical */
		}
	}

	function loadFromStorage(): void {
		if (typeof localStorage === 'undefined') return;
		const key = getStorageKey();
		try {
			const stored = localStorage.getItem(key);
			if (!stored) return;
			const data = JSON.parse(stored) as Record<string, unknown>;
			if (mode === 'mcq' && data.currentQuestion) {
				currentQuestion = data.currentQuestion as GeneratedQuestion;
				hasCheckedAnswer = Boolean(data.hasCheckedAnswer);
				checkedSelection = (data.checkedSelection as string | null) ?? null;
				answerResult = (data.answerResult as AnswerResult | null) ?? null;
				selectedOption = (data.selectedOption as string | null) ?? null;
				showExplanation = Boolean(data.showExplanation);
				statusMessage = typeof data.statusMessage === 'string' ? data.statusMessage : statusMessage;
				startedAtMs = typeof data.startedAtMs === 'number' ? data.startedAtMs : Date.now();
				questionCount = typeof data.questionCount === 'number' ? data.questionCount : questionCount;
			} else if (mode === 'frq' && data.frqQuestion) {
				frqQuestion = data.frqQuestion as FRQQuestion;
				frqResponses = (data.frqResponses as Record<string, string>) ?? {};
				frqGrade = (data.frqGrade as FRQGrade | null) ?? null;
				hasSubmitted = Boolean(data.hasSubmitted);
				statusMessage = typeof data.statusMessage === 'string' ? data.statusMessage : statusMessage;
				startedAtMs = typeof data.startedAtMs === 'number' ? data.startedAtMs : Date.now();
				questionCount = typeof data.questionCount === 'number' ? data.questionCount : questionCount;
			}
		} catch {
			/* non-critical */
		}
	}

	onMount(() => {
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
		return () => {
			window.removeEventListener('resize', onResize);
			window.removeEventListener('keydown', onKeydown);
		};
	});

	$effect(() => {
		void currentQuestion?.prompt;
		requestAnimationFrame(() => detectLongQuestionLayout());
	});

	$effect(() => {
		void selectedClass;
		void selectedUnit;
		currentQuestion = null;
		questionCount = 0;
		resetInteractionState(true);
		resetFRQState();
		statusMessage =
			mode === 'frq'
				? 'Write your response for each part, then submit.'
				: 'Choose the best answer and then check your response.';
		loadFromStorage();
	});

	$effect(() => {
		if (requestVersion > 0) {
			if (mode === 'frq') {
				void loadFRQQuestion();
			} else {
				void loadQuestion();
			}
		}
	});
</script>

{#if isLoading}
	{#if mode === 'frq'}
		<Card.Root class={cn('overflow-hidden border-border/70 shadow-sm', className)}>
			<Card.Header class="gap-3">
				<Skeleton class="h-6 w-48" />
				<Skeleton class="h-4 w-32" />
			</Card.Header>
			<Card.Content class="space-y-6">
				<div class="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-4">
					<Skeleton class="h-4 w-full" />
					<Skeleton class="h-4 w-[92%]" />
					<Skeleton class="h-4 w-[85%]" />
				</div>
				{#each [0, 1, 2] as i (i)}
					<div class="space-y-2">
						<Skeleton class="h-4 w-24" />
						<Skeleton class="h-28 w-full rounded-md" />
					</div>
				{/each}
			</Card.Content>
			<Card.Footer class="border-t border-border/70 bg-muted/20 px-6 py-4">
				<Skeleton class="h-9 w-32" />
			</Card.Footer>
		</Card.Root>
	{:else}
		<QuestionCardSkeleton isTwoColumn={Boolean(currentQuestion?.hasStimulus && !isMobileViewport)} class={className} />
	{/if}
{:else}
	{#snippet cardInner(expanded: boolean)}
		<Card.Content class={cn('flex flex-col gap-6 pt-6', expanded && 'min-h-0 flex-1')}>
			<div class="flex items-start justify-between">
				<div>
					{#if mode === 'frq'}
						<h2 class="mt-0.5 text-xl font-semibold">
							Free Response Question {effectiveQuestionNumber}
						</h2>
						{#if frqQuestion}
							<p class="mt-1 text-xs text-muted-foreground">
								{frqQuestion.totalPoints} point{frqQuestion.totalPoints !== 1 ? 's' : ''} total
							</p>
						{/if}
					{:else}
						<h2 class="mt-0.5 text-xl font-semibold">Question {effectiveQuestionNumber}</h2>
					{/if}
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

			{#if mode === 'frq' && frqQuestion}
				{@const q = frqQuestion}
				{#if frqHasContext && !isMobileViewport}
					<div
						class={cn(
							'overflow-hidden rounded-lg border border-border/70',
							expanded ? 'min-h-0 flex-1' : 'h-80'
						)}
					>
						<Resizable.PaneGroup direction="horizontal" class="h-full">
							<Resizable.Pane defaultSize={48} minSize={28} class="min-w-0">
								<div class="h-full overflow-y-auto p-4 sm:p-5">
									<p
										class="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
									>
										Stimulus
									</p>
									<div class="space-y-3 text-sm leading-6 text-foreground/90">
										<RichText text={q.context ?? ''} />
									</div>
								</div>
							</Resizable.Pane>
							<Resizable.Handle withHandle />
							<Resizable.Pane defaultSize={52} minSize={30} class="min-w-0">
								<div class="h-full space-y-5 overflow-y-auto p-4 sm:p-5">
									<div>
										<p
											class="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
										>
											Prompt
										</p>
										<RichText text={q.prompt} class="text-sm leading-6 text-foreground/90" />
									</div>
									<div class="space-y-4">
										{#each q.parts as part (part.label)}
											{@const response = frqResponses[part.label] ?? ''}
											<div class="space-y-1.5">
												<div class="flex items-start gap-2">
													<span
														class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-muted/50 text-xs font-semibold text-foreground"
													>
														{part.label}
													</span>
													<div class="flex min-w-0 flex-1 items-start justify-between gap-2">
														<RichText
															text={part.question}
															class="text-sm leading-6 text-foreground/90"
														/>
														<span class="shrink-0 text-xs whitespace-nowrap text-muted-foreground">
															{part.pointValue} pt{part.pointValue !== 1 ? 's' : ''}
														</span>
													</div>
												</div>
												<Textarea
													disabled={hasSubmitted}
													value={response}
													oninput={(e) => {
														frqResponses[part.label] = (
															e.currentTarget as HTMLTextAreaElement
														).value;
														saveToStorage();
													}}
													placeholder="Write your response here..."
													class="min-h-24 resize-y text-sm"
												/>
											</div>
										{/each}
									</div>
								</div>
							</Resizable.Pane>
						</Resizable.PaneGroup>
					</div>
				{:else}
					<div class="space-y-2 rounded-lg border border-border/70 bg-muted/10 p-4 sm:p-5">
						<p class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
							Prompt
						</p>
						<RichText text={q.prompt} class="text-sm leading-6 text-foreground/90" />
					</div>
					<div class={cn('space-y-5', expanded && 'min-h-0 flex-1 overflow-y-auto pr-1')}>
						{#each q.parts as part (part.label)}
							{@const response = frqResponses[part.label] ?? ''}
							<div class="space-y-2">
								<div class="flex items-start gap-2">
									<span
										class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-muted/50 text-xs font-semibold text-foreground"
									>
										{part.label}
									</span>
									<div class="flex min-w-0 flex-1 items-start justify-between gap-2">
										<RichText text={part.question} class="text-sm leading-6 text-foreground/90" />
										<span class="shrink-0 text-xs whitespace-nowrap text-muted-foreground">
											{part.pointValue} pt{part.pointValue !== 1 ? 's' : ''}
										</span>
									</div>
								</div>
								<Textarea
									disabled={hasSubmitted}
									value={response}
									oninput={(e) => {
										frqResponses[part.label] = (e.currentTarget as HTMLTextAreaElement).value;
										saveToStorage();
									}}
									placeholder="Write your response here..."
									class="min-h-28 resize-y text-sm"
								/>
							</div>
						{/each}
					</div>
				{/if}

				{#if frqGrade}
					<div class="space-y-4 rounded-lg border border-border/70 bg-muted/20 p-4 sm:p-5">
						<div class="flex flex-wrap items-center gap-3">
							<span
								class={cn('text-2xl font-bold tabular-nums', getScoreColor(frqGrade.totalScore))}
							>
								{frqGrade.totalScore}/100
							</span>
							<span class="text-sm text-muted-foreground">&mdash;</span>
							<span class="text-sm text-foreground/80">{frqGrade.overallFeedback}</span>
						</div>
						<div class="space-y-3">
							{#each frqGrade.parts as partGrade (partGrade.label)}
								<div class={cn('rounded-md border p-3 text-sm', getScoreBg(partGrade.score))}>
									<div class="flex items-center gap-2 font-medium">
										<span
											class="flex size-5 shrink-0 items-center justify-center rounded-full bg-background/60 text-xs"
										>
											{partGrade.label}
										</span>
										<span>{partGrade.pointsEarned}/{partGrade.pointsAvailable} pts</span>
									</div>
									<p class="mt-1.5 text-xs leading-5 text-foreground/80">{partGrade.feedback}</p>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			{:else if currentQuestion?.hasStimulus && !isMobileViewport}
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
							<div class="h-full space-y-3 overflow-y-auto p-4 sm:p-5" bind:this={promptElement}>
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
				<div class="space-y-2" role="radiogroup" aria-label="Answer choices">
					{#each currentQuestion?.options as option (option.id)}
						<button
							type="button"
							role="radio"
							aria-checked={selectedOption === option.id}
							disabled={hasCheckedAnswer}
							onclick={() => handleOptionSelect(option.id)}
							class={cn(
								'w-full rounded-lg border px-4 py-3 text-left transition-colors',
								'focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:outline-none',
								'disabled:cursor-not-allowed disabled:opacity-100',
								optionButtonClasses(option.id)
							)}
						>
							<div class="flex gap-3">
								<span
									class={cn(
										'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
										optionBadgeClasses(option.id)
									)}
								>
									{option.label}
								</span>
								<RichText text={option.text} inline class="text-sm leading-6" />
							</div>
						</button>
					{/each}
				</div>
			{:else if expandedTwoColumn}
				<div
					class={cn(
						'overflow-hidden rounded-lg border border-border/70',
						expanded ? 'min-h-0 flex-1' : 'h-88'
					)}
				>
					<Resizable.PaneGroup direction="horizontal" class="h-full">
						<Resizable.Pane defaultSize={56} minSize={35} class="min-w-0">
							<div class="h-full overflow-y-auto p-4 sm:p-5" bind:this={promptElement}>
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
								<div class="space-y-2" role="radiogroup" aria-label="Answer choices">
									{#each currentQuestion?.options ?? [] as option (option.id)}
										<button
											type="button"
											role="radio"
											aria-checked={selectedOption === option.id}
											disabled={hasCheckedAnswer}
											onclick={() => handleOptionSelect(option.id)}
											class={cn(
												'w-full rounded-lg border px-3 py-2.5 text-left transition-colors',
												'focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:outline-none',
												'disabled:cursor-not-allowed disabled:opacity-100',
												optionButtonClasses(option.id)
											)}
										>
											<div class="flex gap-3">
												<span
													class={cn(
														'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
														optionBadgeClasses(option.id)
													)}
												>
													{option.label}
												</span>
												<RichText text={option.text} inline class="text-sm leading-6" />
											</div>
										</button>
									{/each}
								</div>
							</div>
						</Resizable.Pane>
					</Resizable.PaneGroup>
				</div>
			{:else}
				<div bind:this={promptElement}>
					<RichText
						text={currentQuestion?.prompt ?? ''}
						class="text-base leading-7 text-foreground/90"
					/>
				</div>
				<div class="space-y-2" role="radiogroup" aria-label="Answer choices">
					{#each currentQuestion?.options ?? [] as option (option.id)}
						<button
							type="button"
							role="radio"
							aria-checked={selectedOption === option.id}
							disabled={hasCheckedAnswer}
							onclick={() => handleOptionSelect(option.id)}
							class={cn(
								'w-full rounded-lg border px-4 py-3 text-left transition-colors',
								'focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:outline-none',
								'disabled:cursor-not-allowed disabled:opacity-100',
								optionButtonClasses(option.id)
							)}
						>
							<div class="flex gap-3">
								<span
									class={cn(
										'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
										optionBadgeClasses(option.id)
									)}
								>
									{option.label}
								</span>
								<RichText text={option.text} inline class="text-sm leading-6" />
							</div>
						</button>
					{/each}
				</div>
			{/if}

			{#if mode === 'mcq' && showUtilityActions && !hasCheckedAnswer}
				<div class="flex flex-wrap gap-2">
					<Button variant="ghost" size="sm" onclick={handleSkipQuestion}>{skipLabel}</Button>
					<Button variant="ghost" size="sm" onclick={handleNotLearnedQuestion}>
						{notLearnedLabel}
					</Button>
					<Button variant="ghost" size="sm" onclick={handleReportBugAction}>
						{reportBugLabel}
					</Button>
				</div>
			{/if}
		</Card.Content>

		{#if mode === 'frq'}
			<Card.Footer
				class="flex flex-col gap-3 border-t border-border/70 bg-muted/20 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
			>
				<p class="text-sm text-muted-foreground">{statusMessage}</p>
				<div class="flex shrink-0 gap-2">
					{#if hasSubmitted}
						<Button onclick={handleFRQNext} class="h-9 px-4 text-sm">Next Question</Button>
					{:else}
						<Button
							onclick={handleFRQSubmit}
							disabled={!allPartsAnswered || isGrading}
							class="h-9 px-4 text-sm"
						>
							{isGrading ? 'Grading...' : 'Submit Response'}
						</Button>
					{/if}
				</div>
			</Card.Footer>
		{:else}
			<Card.Footer class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<p class="text-sm text-muted-foreground">{feedbackMessage}</p>
				<div class="flex gap-2">
					{#if hasCheckedAnswer && currentQuestion?.explanation}
						<Button variant="outline" onclick={() => (showExplanation = true)}>
							{showExplanationLabel}
						</Button>
					{/if}
					<Button
						variant="outline"
						onclick={handleNextQuestion}
						disabled={!hasCheckedAnswer && !selectedOption}
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

	<!-- Fullscreen overlay — scales in/out smoothly -->
	{#if isExpanded}
		<div
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

	{#if mode === 'mcq' && currentQuestion && !isExpanded}
		<TutorWidget
			question={currentQuestion.prompt}
			answer={currentQuestion.correctAnswer ?? ''}
			explanation={currentQuestion.explanation ?? ''}
			apClass={selectedClass}
			unit={selectedUnit}
			answerChoices={tutorAnswerChoices}
		/>
	{/if}

	<BugReportDialog bind:open={bugReportOpen} context={bugReportContext} {selectedClass} {selectedUnit} />
{/if}
