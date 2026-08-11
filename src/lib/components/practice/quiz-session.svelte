<script lang="ts">
	import { onDestroy } from 'svelte';
	import { resolve } from '$app/paths';
	import EmptyState from '$lib/components/app/empty-state.svelte';
	import QuestionCard from '$lib/components/questions/question-card.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/api.js';
	import { resolveEffectiveUnit } from '$lib/catalog/ap-classes.js';
	import { requestMcqQuestion } from '$lib/questions/request-mcq.client.js';
	import type { AnswerResult, GeneratedQuestion } from '$lib/questions/types.js';

	type QuizStatus = 'idle' | 'loading' | 'active' | 'review' | 'complete' | 'error';

	type QuizSessionProps = {
		selectedClass: string;
		selectedUnit: string;
		unitRange?: readonly number[];
		count: number;
		requestVersion: number;
		isGenerating?: boolean;
	};

	const MAX_QUIZ_COUNT = 50;
	const MAX_DUPLICATE_RETRIES = 3;

	let {
		selectedClass,
		selectedUnit,
		unitRange,
		count,
		requestVersion,
		isGenerating = $bindable(false)
	}: QuizSessionProps = $props();

	let status = $state<QuizStatus>('idle');
	let questions = $state<Array<GeneratedQuestion | null>>([]);
	let answers = $state<Array<AnswerResult | null>>([]);
	let currentIndex = $state(0);
	let requestedCount = $state(0);
	let loadingCount = $state(0);
	let failedIndexes = $state<number[]>([]);
	let errorMessage = $state('');
	let draftSelections = $state<Array<string | null>>([]);
	let currentSelection = $state<string | null>(null);
	let quizId = '';
	let quizStartedAt = '';
	let historyStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
	let historyError = $state('');
	let lastRequestVersion = 0;
	let lastSelectionKey = '';
	let runToken = 0;

	const loadedCount = $derived(questions.filter(Boolean).length);
	const currentQuestion = $derived(questions[currentIndex] ?? null);
	const currentAnswer = $derived(answers[currentIndex] ?? null);
	const isLastQuestion = $derived(currentIndex === requestedCount - 1);
	const nextQuestionReady = $derived(isLastQuestion || Boolean(questions[currentIndex + 1]));
	const answeredQuestionCount = $derived(draftSelections.filter(Boolean).length);
	const canFinish = $derived(
		loadingCount === 0 && failedIndexes.length === 0 && loadedCount === requestedCount
	);
	const nextLabel = $derived(
		nextQuestionReady && (!isLastQuestion || canFinish) ? 'Next' : 'Loading next…'
	);
	const correctCount = $derived(answers.filter((answer) => answer?.isCorrect === true).length);
	const incorrectCount = $derived(answers.filter((answer) => answer?.isCorrect === false).length);
	const unansweredCount = $derived(Math.max(requestedCount - correctCount - incorrectCount, 0));
	const scorePercent = $derived(
		requestedCount > 0 ? Math.round((correctCount / requestedCount) * 100) : 0
	);
	const coachReviewHref = $derived.by(() => {
		const missedQuestions = questions.flatMap((question, index) => {
			const answer = answers[index];
			if (!question || answer?.isCorrect !== false) return [];
			return [
				`Question ${index + 1} (ID ${question.questionId ?? 'unknown'}): selected ${answer.selectedAnswer ?? 'unanswered'}, correct ${answer.correctAnswer}.`
			];
		});
		const missedSummary = missedQuestions.slice(0, 12);
		if (missedQuestions.length > missedSummary.length) {
			missedSummary.push(
				`Plus ${missedQuestions.length - missedSummary.length} more missed questions.`
			);
		}
		const unansweredPositions = answers.flatMap((answer, index) => (answer ? [] : [index + 1]));
		const prompt = [
			'I just finished a graded practice quiz and want to review it with you.',
			`Quiz ID: ${quizId}.`,
			`Course: ${selectedClass}. Unit: ${selectedUnit || 'All Units'}.`,
			`Score: ${correctCount}/${requestedCount} (${scorePercent}%).`,
			missedSummary.length
				? `Missed questions:\n${missedSummary.join('\n')}`
				: 'I did not miss any answered questions.',
			unansweredPositions.length
				? `Unanswered question positions: ${unansweredPositions.slice(0, 20).join(', ')}.`
				: '',
			'Use read_quiz_attempt with the Quiz ID and the missed or unanswered question positions to inspect the canonical questions. Help me identify the concepts I should review and give me a short next-step plan.'
		]
			.filter(Boolean)
			.join('\n');
		return `${resolve('/app/coach')}?prompt=${encodeURIComponent(prompt)}`;
	});

	$effect(() => {
		const version = requestVersion;
		const selectionKey = `${selectedClass}:${selectedUnit}:${unitRange?.join(',') ?? ''}`;
		if (selectionKey !== lastSelectionKey) {
			lastSelectionKey = selectionKey;
			if (version === 0) {
				runToken += 1;
				setGenerating(false);
				status = 'idle';
				questions = [];
				answers = [];
				draftSelections = [];
				failedIndexes = [];
				loadingCount = 0;
				historyStatus = 'idle';
				historyError = '';
			}
		}
		if (version === 0) {
			lastRequestVersion = 0;
			return;
		}
		if (version === lastRequestVersion) return;

		lastRequestVersion = version;
		void startQuiz();
	});

	function normalizeCount(value: number): number {
		if (!Number.isFinite(value)) return 10;
		return Math.min(MAX_QUIZ_COUNT, Math.max(1, Math.floor(value)));
	}

	function isCurrentRun(token: number): boolean {
		return token === runToken;
	}

	function setGenerating(value: boolean): void {
		if (isGenerating !== value) isGenerating = value;
	}

	async function fetchQuizQuestion(excludeQuestionIds: string[]): Promise<GeneratedQuestion> {
		const effectiveUnit = resolveEffectiveUnit(selectedClass, selectedUnit, unitRange);
		const result = await requestMcqQuestion(selectedClass, effectiveUnit, excludeQuestionIds);
		if (!result.question.correctAnswer) {
			throw new Error('Question did not include an answer key.');
		}
		return result.question;
	}

	function questionId(question: GeneratedQuestion): string | undefined {
		const id = question.questionId?.trim();
		return id || undefined;
	}

	async function fillIndexes(
		token: number,
		indexes: number[],
		seenQuestionIds: string[]
	): Promise<void> {
		for (const index of indexes) {
			if (!isCurrentRun(token)) return;

			let question: GeneratedQuestion | null = null;
			let lastError: unknown = null;

			for (let attempt = 0; attempt <= MAX_DUPLICATE_RETRIES; attempt += 1) {
				try {
					const candidate = await fetchQuizQuestion(seenQuestionIds);
					const candidateId = questionId(candidate);
					if (
						candidateId &&
						seenQuestionIds.includes(candidateId) &&
						attempt < MAX_DUPLICATE_RETRIES
					) {
						continue;
					}

					question = candidate;
					if (candidateId) seenQuestionIds.push(candidateId);
					break;
				} catch (error) {
					lastError = error;
					break;
				}
			}

			if (!isCurrentRun(token)) return;

			if (question) {
				questions[index] = question;
			} else {
				failedIndexes = [...failedIndexes, index];
				if (lastError instanceof Error) errorMessage = lastError.message;
			}
			loadingCount = Math.max(0, loadingCount - 1);
		}

		if (isCurrentRun(token) && loadingCount === 0) setGenerating(false);
	}

	async function startQuiz(): Promise<void> {
		const token = ++runToken;
		const targetCount = normalizeCount(count);

		status = 'loading';
		errorMessage = '';
		questions = Array.from({ length: targetCount }, () => null);
		answers = Array.from({ length: targetCount }, () => null);
		draftSelections = Array.from({ length: targetCount }, () => null);
		currentIndex = 0;
		currentSelection = null;
		requestedCount = targetCount;
		loadingCount = targetCount;
		failedIndexes = [];
		quizId = crypto.randomUUID();
		quizStartedAt = new Date().toISOString();
		historyStatus = 'idle';
		historyError = '';
		setGenerating(true);

		if (!selectedClass) {
			status = 'error';
			errorMessage = 'Choose an AP class before generating a quiz.';
			loadingCount = 0;
			setGenerating(false);
			return;
		}

		try {
			const firstQuestion = await fetchQuizQuestion([]);
			if (!isCurrentRun(token)) return;

			questions[0] = firstQuestion;
			loadingCount = Math.max(0, targetCount - 1);
			status = 'active';

			if (targetCount > 1) {
				const seenQuestionIds: string[] = [];
				const firstId = questionId(firstQuestion);
				if (firstId) seenQuestionIds.push(firstId);
				void fillIndexes(
					token,
					Array.from({ length: targetCount - 1 }, (_, index) => index + 1),
					seenQuestionIds
				);
			} else {
				setGenerating(false);
			}
		} catch (error) {
			if (!isCurrentRun(token)) return;
			status = 'error';
			loadingCount = 0;
			setGenerating(false);
			errorMessage = error instanceof Error ? error.message : 'Could not generate this quiz.';
		}
	}

	async function retryFailedQuestions(): Promise<void> {
		if (!failedIndexes.length || status === 'loading') return;

		const token = ++runToken;
		const retryIndexes = [...failedIndexes];
		failedIndexes = [];
		loadingCount = retryIndexes.length;
		setGenerating(true);
		errorMessage = '';

		const seenQuestionIds = questions.flatMap((question) => {
			const id = question ? questionId(question) : undefined;
			return id ? [id] : [];
		});
		await fillIndexes(token, retryIndexes, seenQuestionIds);
	}

	function handleAnswered(result: AnswerResult): void {
		answers[currentIndex] = result;
		if (result.selectedAnswer) draftSelections[currentIndex] = result.selectedAnswer;
	}

	function handleOptionSelected(selectedOption: string): void {
		draftSelections[currentIndex] = selectedOption;
	}

	function handleQuestionJump(index: number): void {
		if (status !== 'active' || !questions[index] || index === currentIndex) return;
		currentIndex = index;
		currentSelection = draftSelections[index] ?? null;
	}

	function handleReviewQuestion(index: number): void {
		if (!questions[index]) return;
		currentIndex = index;
		currentSelection = draftSelections[index] ?? null;
		status = 'active';
	}

	function buildQuizAnswers(): Array<AnswerResult | null> {
		return questions.map((question, index) => {
			const selectedAnswer = draftSelections[index];
			if (!question || !selectedAnswer || !question.correctAnswer) return null;
			return {
				questionId: question.questionId?.trim() || undefined,
				questionNumber: String(index + 1),
				selectedAnswer,
				correctAnswer: question.correctAnswer,
				isCorrect: selectedAnswer === question.correctAnswer,
				timeTakenMs: 0
			};
		});
	}

	function submitQuiz(): void {
		if (!canFinish) return;
		answers = buildQuizAnswers();
		status = 'complete';
		void persistQuizHistory();
	}

	function handleQuizNext(): void {
		if (!nextQuestionReady) return;
		if (isLastQuestion) {
			if (!canFinish) return;
			status = 'review';
			return;
		}
		currentIndex += 1;
		currentSelection = draftSelections[currentIndex] ?? null;
	}

	async function persistQuizHistory(): Promise<void> {
		if (historyStatus === 'saving' || historyStatus === 'saved') return;
		const items = questions.map((question, position) => ({
			position,
			questionId: question?.questionId?.trim() ?? '',
			selectedAnswer: answers[position]?.selectedAnswer ?? null,
			timeTakenMs: answers[position]?.timeTakenMs ?? null
		}));
		if (items.some((item) => !item.questionId)) {
			historyStatus = 'error';
			historyError = 'This quiz could not be saved because a question ID was missing.';
			return;
		}

		historyStatus = 'saving';
		historyError = '';
		try {
			const response = await apiFetch('/api/me/quiz-attempts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					quizId,
					apClass: selectedClass,
					unit: selectedUnit || 'All Units',
					startedAt: quizStartedAt,
					items
				})
			});
			const payload = await readJsonOrNull<{ error?: string }>(response);
			if (!response.ok)
				throw new Error(getResponseMessage(payload, 'Could not save quiz history.'));
			historyStatus = 'saved';
		} catch (error) {
			historyStatus = 'error';
			historyError = error instanceof Error ? error.message : 'Could not save quiz history.';
		}
	}

	onDestroy(() => {
		runToken += 1;
	});
</script>

{#if status === 'idle'}
	<EmptyState
		title="No quiz yet"
		description="Choose a course and unit, then generate a quiz."
		imageUrl="/illustrations/books.png"
	/>
{:else if status === 'loading' || status === 'error'}
	<Card.Root class="border-border/70 bg-transparent shadow-none ring-0">
		<Card.Content
			class="flex min-h-40 flex-col items-center justify-center gap-3 px-6 py-12 text-center"
		>
			{#if status === 'loading'}
				<p class="text-lg font-medium text-muted-foreground">Generating your quiz…</p>
				<p class="text-sm text-muted-foreground/80">Loading {requestedCount} questions.</p>
			{:else}
				<p class="text-lg font-medium text-muted-foreground">We couldn’t generate this quiz</p>
				<p class="max-w-sm text-sm text-muted-foreground/80">
					{errorMessage || 'Please try again in a moment.'}
				</p>
				<Button onclick={() => void startQuiz()}>Try again</Button>
			{/if}
		</Card.Content>
	</Card.Root>
{:else if status === 'complete'}
	<Card.Root class="border-border/70 bg-card/95 shadow-sm">
		<Card.Content class="space-y-8 px-6 py-10 text-center sm:px-10">
			<div class="space-y-2">
				<p class="text-sm font-medium tracking-wide text-muted-foreground uppercase">
					Quiz complete
				</p>
				<p class="font-display text-6xl font-medium tracking-tight text-foreground">
					{correctCount} <span class="text-3xl text-muted-foreground">/ {requestedCount}</span>
				</p>
				<p class="text-sm text-muted-foreground">{scorePercent}% correct</p>
			</div>

			{#if historyStatus === 'saving'}
				<p class="text-sm text-muted-foreground" role="status">Saving to your history…</p>
			{:else if historyStatus === 'saved'}
				<p class="text-sm text-emerald-600 dark:text-emerald-400" role="status">Saved to history</p>
			{:else if historyStatus === 'error'}
				<div class="space-y-2" role="alert">
					<p class="text-sm text-destructive">{historyError}</p>
					<Button variant="outline" size="sm" onclick={() => void persistQuizHistory()}>
						Retry save
					</Button>
				</div>
			{/if}

			<div
				class="mx-auto grid max-w-md grid-cols-3 divide-x divide-border border-y border-border py-4"
			>
				<div class="space-y-1 px-3">
					<p class="text-xl font-semibold text-emerald-600 dark:text-emerald-400">{correctCount}</p>
					<p class="text-xs text-muted-foreground">Correct</p>
				</div>
				<div class="space-y-1 px-3">
					<p class="text-xl font-semibold text-red-600 dark:text-red-400">{incorrectCount}</p>
					<p class="text-xs text-muted-foreground">Incorrect</p>
				</div>
				<div class="space-y-1 px-3">
					<p class="text-xl font-semibold text-muted-foreground">{unansweredCount}</p>
					<p class="text-xs text-muted-foreground">Unanswered</p>
				</div>
			</div>

			<div class="flex flex-wrap justify-center gap-2">
				<Button href={coachReviewHref} variant="outline">Review with Coach</Button>
				<Button onclick={() => void startQuiz()}>Try another quiz</Button>
			</div>
		</Card.Content>
	</Card.Root>
{:else if status === 'review'}
	<Card.Root class="border-border/70 bg-card/95 shadow-sm">
		<Card.Content class="space-y-6 px-6 py-8 sm:px-10">
			<div class="space-y-2 text-center">
				<h2 class="font-display text-3xl font-medium tracking-tight text-foreground">
					Check your answers before submitting
				</h2>
				<p class="text-sm text-muted-foreground">
					{answeredQuestionCount} of {requestedCount} questions answered. Select a question to revisit
					it.
				</p>
			</div>

			<div class="grid gap-2 sm:grid-cols-2">
				{#each questions as question, index (index)}
					<Button
						type="button"
						variant={draftSelections[index] ? 'secondary' : 'outline'}
						class="h-auto justify-between gap-3 px-4 py-3 text-left"
						disabled={!question}
						onclick={() => handleReviewQuestion(index)}
						aria-label={`Review question ${index + 1}${draftSelections[index] ? ', answered' : ', not answered'}`}
					>
						<span>Question {index + 1}</span>
						<span class="text-sm font-normal text-muted-foreground">
							{draftSelections[index] ? `Answer ${draftSelections[index]}` : 'Not answered'}
						</span>
					</Button>
				{/each}
			</div>

			<div class="flex justify-center">
				<Button onclick={submitQuiz}>Submit quiz</Button>
			</div>
		</Card.Content>
	</Card.Root>
{:else if currentQuestion}
	<div class="space-y-4">
		<div class="flex flex-wrap items-center gap-2" aria-label="Quiz questions" role="navigation">
			{#each questions as question, index (index)}
				<Button
					type="button"
					size="icon"
					variant={currentIndex === index
						? 'default'
						: draftSelections[index]
							? 'secondary'
							: 'outline'}
					class="size-9"
					disabled={!question}
					onclick={() => handleQuestionJump(index)}
					aria-label={`Go to question ${index + 1}${draftSelections[index] ? ', answered' : ''}`}
					aria-current={currentIndex === index ? 'step' : undefined}
				>
					{index + 1}
				</Button>
			{/each}
			<p class="text-xs text-muted-foreground">{answeredQuestionCount} answered</p>
		</div>

		{#if loadingCount > 0}
			<p class="text-xs text-muted-foreground" aria-live="polite">
				Preparing the remaining questions in the background.
			</p>
		{/if}

		{#if failedIndexes.length > 0}
			<div
				class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm dark:border-amber-400/30 dark:bg-amber-950/20"
				role="status"
			>
				<p class="text-amber-900 dark:text-amber-100">
					Some questions still need to be loaded before you can continue.
				</p>
				<Button variant="outline" size="sm" onclick={() => void retryFailedQuestions()}>
					Retry loading
				</Button>
			</div>
		{/if}

		{#key `${currentIndex}:${currentQuestion.questionId ?? currentQuestion.prompt}`}
			<QuestionCard
				quizMode
				quizQuestion={currentQuestion}
				quizAnswer={currentAnswer}
				questionNumber={String(currentIndex + 1)}
				{selectedClass}
				{selectedUnit}
				checkLabel="Submit answer"
				{nextLabel}
				nextDisabled={isLastQuestion ? !canFinish : !nextQuestionReady}
				bind:selectedOption={currentSelection}
				onOptionSelected={handleOptionSelected}
				showUtilityActions={false}
				autoShowExplanation={false}
				onAnswered={handleAnswered}
				onQuizNext={handleQuizNext}
			/>
		{/key}
	</div>
{/if}
