<script lang="ts">
	import { onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import EmptyState from '$lib/components/app/empty-state.svelte';
	import QuestionCard from '$lib/components/questions/question-card.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/api.js';
	import { resolveEffectiveUnit } from '$lib/catalog/ap-classes.js';
	import { requestMcqQuestion } from '$lib/question-bank/request.client.js';
	import type { AnswerResult, GeneratedQuestion } from '$lib/question-bank/mcq/types.js';
	import { savePendingSharedQuizRun } from '$lib/shared-practice/pending-runs.js';
	import type { PendingSharedQuizRun } from '$lib/shared-practice/types.js';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import ShareIcon from '@lucide/svelte/icons/share';
	import UsersIcon from '@lucide/svelte/icons/users';
	import type { Snippet } from 'svelte';
	import { quizQuestionCardModel } from '$lib/question-bank/question-card-model';

	type QuizStatus = 'idle' | 'loading' | 'active' | 'review' | 'complete' | 'error';

	type QuizSessionProps = {
		selectedClass: string;
		selectedUnit: string;
		unitRange?: readonly number[];
		count: number;
		requestVersion: number;
		enabled?: boolean;
		isGenerating?: boolean;
		expanded?: boolean;
		persistHistory?: boolean;
		showCoachReview?: boolean;
		initialQuestions?: GeneratedQuestion[] | null;
		sharedSlug?: string;
		onExpand?: () => void;
		controlsOpen?: boolean;
		practiceControls?: Snippet;
	};

	const MAX_QUIZ_COUNT = 50;
	const MAX_DUPLICATE_RETRIES = 3;

	let {
		selectedClass,
		selectedUnit,
		unitRange,
		count,
		requestVersion,
		enabled = true,
		isGenerating = $bindable(false),
		expanded = false,
		persistHistory = true,
		showCoachReview = true,
		initialQuestions = null,
		sharedSlug = '',
		onExpand,
		controlsOpen = $bindable(false),
		practiceControls
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
	let quizId = $state('');
	let quizStartedAt = $state('');
	let historyStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
	let historyError = $state('');
	let shareStatus = $state('');
	let shareUrl = $state('');
	let shareSetId = $state('');
	let shareAttachedToGroup = $state(false);
	let shareCreating = $state(false);
	let shareOpen = $state(false);
	let pendingClaimSaved = $state(false);
	let questionNavOpen = $state(false);
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
	const isSharedQuiz = $derived(Boolean(sharedSlug));
	const canShareQuiz = $derived(
		!isSharedQuiz && requestedCount > 0 && loadedCount === requestedCount
	);
	const groupOrganizationId = $derived.by(() => {
		const organization = page.data.activeOrganization;
		if (!organization || organization.orgType !== 'group') return null;
		if (organization.role !== 'owner' && organization.role !== 'admin') return null;
		return organization.id;
	});
	const claimSignupHref = $derived(
		`${resolve('/signup')}?returnTo=${encodeURIComponent(resolve('/app'))}`
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
		const isEnabled = enabled;
		const selectionKey = `${selectedClass}:${selectedUnit}:${unitRange?.join(',') ?? ''}`;
		if (selectionKey !== lastSelectionKey) {
			lastSelectionKey = selectionKey;
			if (!isEnabled || version === 0) {
				runToken += 1;
				setGenerating(false);
				status = 'idle';
				questions = [];
				answers = [];
				draftSelections = [];
				failedIndexes = [];
				loadingCount = 0;
				questionNavOpen = false;
				historyStatus = 'idle';
				historyError = '';
				shareStatus = '';
				shareUrl = '';
				shareSetId = '';
				shareAttachedToGroup = false;
				shareCreating = false;
				shareOpen = false;
				pendingClaimSaved = false;
			}
		}
		if (!isEnabled) return;
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
		let nextIndex = 0;
		const seenIds = [...seenQuestionIds];

		async function fillNextIndex(): Promise<void> {
			while (isCurrentRun(token)) {
				const index = indexes[nextIndex++];
				if (index === undefined) return;

				let question: GeneratedQuestion | null = null;
				let lastError: unknown = null;

				for (let attempt = 0; attempt <= MAX_DUPLICATE_RETRIES; attempt += 1) {
					try {
						const candidate = await fetchQuizQuestion([...seenIds]);
						const candidateId = questionId(candidate);
						if (candidateId && seenIds.includes(candidateId) && attempt < MAX_DUPLICATE_RETRIES) {
							continue;
						}

						question = candidate;
						if (candidateId) {
							seenIds.push(candidateId);
							seenQuestionIds.push(candidateId);
						}
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
		}

		const workerCount = Math.min(4, indexes.length);
		await Promise.all(Array.from({ length: workerCount }, () => fillNextIndex()));

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
		questionNavOpen = false;
		requestedCount = targetCount;
		loadingCount = targetCount;
		failedIndexes = [];
		quizId = crypto.randomUUID();
		quizStartedAt = new Date().toISOString();
		historyStatus = 'idle';
		historyError = '';
		shareStatus = '';
		shareUrl = '';
		shareSetId = '';
		shareAttachedToGroup = false;
		shareCreating = false;
		shareOpen = false;
		pendingClaimSaved = false;
		setGenerating(true);

		if (!selectedClass) {
			status = 'error';
			errorMessage = 'Choose an AP class before generating a quiz.';
			loadingCount = 0;
			setGenerating(false);
			return;
		}

		if (initialQuestions?.length) {
			const fixedQuestions = initialQuestions.map((question) => ({ ...question }));
			requestedCount = fixedQuestions.length;
			questions = fixedQuestions;
			answers = Array.from({ length: fixedQuestions.length }, () => null);
			draftSelections = Array.from({ length: fixedQuestions.length }, () => null);
			loadingCount = 0;
			status = 'active';
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

	function handleOptionSelected(selectedOption: string | null): void {
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
			const recorded = answers[index];
			return {
				questionId: question.questionId?.trim() || undefined,
				questionNumber: String(index + 1),
				selectedAnswer,
				correctAnswer: question.correctAnswer,
				isCorrect: selectedAnswer === question.correctAnswer,
				timeTakenMs: recorded?.timeTakenMs ?? 0
			};
		});
	}

	function submitQuiz(): void {
		if (!canFinish) return;
		answers = buildQuizAnswers();
		status = 'complete';
		if (persistHistory) void persistQuizHistory();
		else if (sharedSlug) saveAnonymousSharedRun();
	}

	function saveAnonymousSharedRun(): void {
		const run: PendingSharedQuizRun = {
			quizId,
			sharedSlug,
			apClass: selectedClass,
			unit: selectedUnit || 'All Units',
			startedAt: quizStartedAt,
			retryCount: 0,
			items: questions.map((question, position) => ({
				position,
				questionId: question?.questionId?.trim() ?? '',
				selectedAnswer: answers[position]?.selectedAnswer ?? null,
				timeTakenMs: answers[position]?.timeTakenMs ?? null
			}))
		};
		if (run.items.some((item) => !item.questionId)) {
			historyError = 'This quiz could not be saved because a question ID was missing.';
			return;
		}
		if (savePendingSharedQuizRun(run)) pendingClaimSaved = true;
		else historyError = 'This quiz could not be saved. Please try again after signing up.';
	}

	async function ensureShareUrl(attachToGroup: boolean): Promise<string> {
		if (!canShareQuiz) {
			throw new Error('This quiz is not ready to share yet.');
		}
		if (shareUrl) {
			if (!attachToGroup || shareAttachedToGroup) return shareUrl;
			if (!shareSetId || !groupOrganizationId) {
				throw new Error('This quiz cannot be shared with your group right now.');
			}
		}

		shareCreating = true;
		shareStatus = attachToGroup ? 'Sharing with your group…' : 'Creating share link…';
		try {
			if (shareUrl && attachToGroup && shareSetId && groupOrganizationId) {
				const response = await apiFetch(`/api/shared-practice-sets/${shareSetId}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ organizationId: groupOrganizationId })
				});
				const payload = await readJsonOrNull<{ error?: string }>(response);
				if (!response.ok) {
					throw new Error(getResponseMessage(payload, 'Could not share with your group.'));
				}
				shareAttachedToGroup = true;
				return shareUrl;
			}

			const questionIds = questions.map((question) => question?.questionId?.trim() ?? '');
			if (questionIds.some((questionId) => !questionId)) {
				throw new Error('A question is missing its ID.');
			}
			const response = await apiFetch('/api/shared-practice-sets', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					questionIds,
					unit: selectedUnit || 'All Units',
					...(attachToGroup && groupOrganizationId ? { organizationId: groupOrganizationId } : {})
				})
			});
			const payload = await readJsonOrNull<{
				sharedQuiz?: { id?: string; url?: string };
				error?: string;
			}>(response);
			if (!response.ok || !payload?.sharedQuiz?.url) {
				throw new Error(getResponseMessage(payload, 'Could not create a share link.'));
			}
			shareUrl = payload.sharedQuiz.url;
			shareSetId = payload.sharedQuiz.id ?? '';
			shareAttachedToGroup = Boolean(attachToGroup && groupOrganizationId);
			return shareUrl;
		} finally {
			shareCreating = false;
		}
	}

	async function copyShareLink(): Promise<void> {
		try {
			const url = await ensureShareUrl(false);
			await navigator.clipboard.writeText(url);
			shareStatus = 'Share link copied.';
			shareOpen = false;
		} catch (error) {
			shareStatus = error instanceof Error ? error.message : 'Could not copy the quiz link.';
		}
	}

	async function shareToGroup(): Promise<void> {
		if (!groupOrganizationId) return;
		try {
			await ensureShareUrl(true);
			shareStatus = 'Shared with your group.';
			shareOpen = false;
		} catch (error) {
			shareStatus = error instanceof Error ? error.message : 'Could not share with your group.';
		}
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
					...(sharedSlug ? { sharedSlug } : {}),
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

			{#if persistHistory}
				{#if historyStatus === 'saving'}
					<p class="text-sm text-muted-foreground" role="status">Saving to your history…</p>
				{:else if historyStatus === 'saved'}
					<p class="text-sm text-emerald-600 dark:text-emerald-400" role="status">
						Saved to history
					</p>
				{:else if historyStatus === 'error'}
					<div class="space-y-2" role="alert">
						<p class="text-sm text-destructive">{historyError}</p>
						<Button variant="outline" size="sm" onclick={() => void persistQuizHistory()}>
							Retry save
						</Button>
					</div>
				{/if}
			{/if}

			{#if pendingClaimSaved}
				<div class="space-y-2" role="status">
					<p class="text-sm text-muted-foreground">Sign up to save this quiz and your progress.</p>
					<Button href={claimSignupHref} variant="outline" size="sm">Sign up to save</Button>
				</div>
			{/if}

			{#if !persistHistory && historyError}
				<p class="text-sm text-destructive" role="alert">{historyError}</p>
			{/if}

			{#if canShareQuiz || shareUrl}
				<div class="space-y-2">
					{#snippet shareMenu(buttonClass = '')}
						<Popover.Root bind:open={shareOpen}>
							<Popover.Trigger>
								{#snippet child({ props })}
									<Button
										{...props}
										type="button"
										variant="outline"
										size="sm"
										class={buttonClass}
										disabled={shareCreating}
										aria-label="Share quiz"
									>
										<ShareIcon class="size-4" />
										Share quiz
										<ChevronDownIcon class="size-4 opacity-60" />
									</Button>
								{/snippet}
							</Popover.Trigger>
							<Popover.Content align="end" class="w-52 gap-0 p-1">
								<button
									type="button"
									class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
									disabled={shareCreating}
									onclick={() => void copyShareLink()}
								>
									<CopyIcon class="size-4 text-muted-foreground" />
									Copy link
								</button>
								{#if groupOrganizationId}
									<button
										type="button"
										class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
										disabled={shareCreating || shareAttachedToGroup}
										onclick={() => void shareToGroup()}
									>
										<UsersIcon class="size-4 text-muted-foreground" />
										{shareAttachedToGroup ? 'Shared with group' : 'Share to group'}
									</button>
								{/if}
							</Popover.Content>
						</Popover.Root>
					{/snippet}
					{@render shareMenu()}
					{#if shareStatus}
						<p class="text-xs text-muted-foreground" role="status">{shareStatus}</p>
					{/if}
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
				{#if persistHistory && showCoachReview}
					<Button href={coachReviewHref} variant="outline">Review with Coach</Button>
				{/if}
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
	<div class={expanded ? 'flex min-h-0 flex-1 flex-col gap-4' : 'space-y-4'}>
		{#snippet questionHeaderActions()}
			{#if canShareQuiz}
				<Popover.Root bind:open={shareOpen}>
					<Popover.Trigger>
						{#snippet child({ props })}
							<Button
								{...props}
								type="button"
								variant="ghost"
								size="icon"
								class="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
								disabled={shareCreating}
								aria-label="Share quiz"
							>
								<ShareIcon class="size-4" />
							</Button>
						{/snippet}
					</Popover.Trigger>
					<Popover.Content align="end" class="w-52 gap-0 p-1">
						<button
							type="button"
							class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
							disabled={shareCreating}
							onclick={() => void copyShareLink()}
						>
							<CopyIcon class="size-4 text-muted-foreground" />
							Copy link
						</button>
						{#if groupOrganizationId}
							<button
								type="button"
								class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
								disabled={shareCreating || shareAttachedToGroup}
								onclick={() => void shareToGroup()}
							>
								<UsersIcon class="size-4 text-muted-foreground" />
								{shareAttachedToGroup ? 'Shared with group' : 'Share to group'}
							</button>
						{/if}
					</Popover.Content>
				</Popover.Root>
				{#if shareStatus}
					<span class="max-w-32 text-xs text-muted-foreground" role="status">{shareStatus}</span>
				{/if}
			{/if}
		{/snippet}

		{#snippet questionNavigation()}
			<div class="relative flex flex-wrap justify-center gap-2">
				<div class="relative flex justify-center">
					{#if questionNavOpen}
						<div
							id="quiz-question-navigation"
							class="absolute bottom-full left-1/2 z-30 mb-3 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-border/70 bg-card/98 p-2 shadow-xl backdrop-blur-sm"
							role="dialog"
							aria-label="Quiz questions"
						>
							<div class="grid max-h-48 grid-cols-5 gap-1 overflow-y-auto sm:grid-cols-8">
								{#each questions as question, index (index)}
									<Button
										type="button"
										size="icon"
										variant={currentIndex === index
											? 'default'
											: draftSelections[index]
												? 'secondary'
												: 'outline'}
										class="size-8"
										disabled={!question}
										onclick={() => handleQuestionJump(index)}
										aria-label={`Go to question ${index + 1}${draftSelections[index] ? ', answered' : ''}`}
										aria-current={currentIndex === index ? 'step' : undefined}
									>
										{index + 1}
									</Button>
								{/each}
							</div>
							<p class="mt-2 text-center text-xs text-muted-foreground">
								{answeredQuestionCount} of {requestedCount} answered
							</p>
						</div>
					{/if}

					<Button
						type="button"
						class="h-8 rounded-md bg-foreground px-3 text-xs font-semibold text-background shadow-sm hover:bg-foreground/90"
						onclick={() => (questionNavOpen = !questionNavOpen)}
						aria-expanded={questionNavOpen}
						aria-controls="quiz-question-navigation"
					>
						Question {currentIndex + 1} of {requestedCount}
						{#if questionNavOpen}
							<ChevronDownIcon class="size-3.5" />
						{:else}
							<ChevronUpIcon class="size-3.5" />
						{/if}
					</Button>
				</div>
			</div>
		{/snippet}

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
				model={quizQuestionCardModel({
					selectedClass,
					selectedUnit,
					question: currentQuestion,
					answer: currentAnswer,
					questionNumber: String(currentIndex + 1)
				})}
				{expanded}
				{onExpand}
				bind:controlsOpen
				{practiceControls}
				headerActions={questionHeaderActions}
				quizNavigation={questionNavigation}
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
