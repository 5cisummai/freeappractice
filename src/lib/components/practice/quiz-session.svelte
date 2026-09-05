<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import EmptyState from '$lib/components/app/empty-state.svelte';
	import FullQuestion from '$lib/components/questions/full-question.svelte';
	import { createExamCore } from '$lib/components/questions/exam-core.svelte.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/api.js';
	import { resolveEffectiveUnit } from '$lib/catalog/ap-classes.js';
	import { requestMcqQuestion, requestMcqQuiz } from '$lib/question-bank/request.client.js';
	import { createTextAnnotation } from '$lib/components/questions/text-annotation-dom.js';
	import type {
		AddTextAnnotationInput,
		ExamSnapshot,
		GeneratedQuestion,
		TextAnnotation
	} from '$lib/question-bank/mcq/types.js';
	import { savePendingSharedQuizRun } from '$lib/shared-practice/pending-runs.js';
	import type { PendingSharedQuizRun } from '$lib/shared-practice/types.js';
	import ChevronDownIcon from '@tabler/icons-svelte/icons/chevron-down';
	import CopyIcon from '@tabler/icons-svelte/icons/copy';
	import ShareIcon from '@tabler/icons-svelte/icons/share';
	import UsersIcon from '@tabler/icons-svelte/icons/users';

	type QuizSessionProps = {
		selectedClass: string;
		selectedUnit: string;
		unitRange?: readonly number[];
		count: number;
		requestVersion: number;
		enabled?: boolean;
		isGenerating?: boolean;
		persistHistory?: boolean;
		showCoachReview?: boolean;
		initialQuestions?: GeneratedQuestion[] | null;
		sharedSlug?: string;
		title?: string;
		onExit?: () => void;
	};

	let {
		selectedClass,
		selectedUnit,
		unitRange,
		count,
		requestVersion,
		enabled = true,
		isGenerating = $bindable(false),
		persistHistory = true,
		showCoachReview = true,
		initialQuestions = null,
		sharedSlug = '',
		title,
		onExit
	}: QuizSessionProps = $props();

	let mounted = $state(false);
	let exitConfirmOpen = $state(false);
	let historyStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
	let historyError = $state('');
	let shareStatus = $state('');
	let shareUrl = $state('');
	let shareSetId = $state('');
	let shareAttachedToGroup = $state(false);
	let shareCreating = $state(false);
	let shareOpen = $state(false);
	let pendingClaimSaved = $state(false);
	let struckByQuestionId = $state<Record<string, string[]>>({});
	let annotationsByQuestionId = $state<Record<string, TextAnnotation[]>>({});
	let annotationsByStimulusId = $state<Record<string, TextAnnotation[]>>({});
	let stimulusScrollTopById = $state<Record<string, number>>({});
	let lastSnapshot = $state<ExamSnapshot | null>(null);
	let lastRequestVersion = 0;
	let lastSelectionKey = '';

	const exam = createExamCore({
		getMounted: () => mounted,
		loadQuestion: async (excludeIds) => {
			const unit = resolveEffectiveUnit(selectedClass, selectedUnit, unitRange);
			const result = await requestMcqQuestion(selectedClass, unit, excludeIds);
			if (!result.question.correctAnswer) {
				throw new Error('Question did not include an answer key.');
			}
			return result.question;
		},
		loadQuestions: async (requestedCount) => {
			const questions = await requestMcqQuiz(
				selectedClass,
				selectedUnit,
				requestedCount,
				unitRange
			);
			if (questions.some((question) => !question.correctAnswer)) {
				throw new Error('Quiz service returned a question without an answer key.');
			}
			return questions;
		},
		onComplete: (snapshot) => {
			lastSnapshot = snapshot;
			if (persistHistory) void persistQuizHistory(snapshot);
			else if (sharedSlug) saveAnonymousSharedRun(snapshot);
		}
	});

	const isSharedQuiz = $derived(Boolean(sharedSlug));
	const canShareQuiz = $derived(
		!isSharedQuiz && exam.requestedCount > 0 && exam.loadedCount === exam.requestedCount
	);
	const groupOrganizationId = $derived.by(() => {
		const organization = page.data.activeOrganization;
		if (!organization || organization.orgType !== 'group') return null;
		if (organization.role !== 'owner' && organization.role !== 'admin') return null;
		return organization.id as string;
	});
	const claimSignupHref = $derived(
		`${resolve('/signup')}?redirect=${encodeURIComponent(resolve('/app'))}`
	);
	const quizTitle = $derived(
		title ??
			(selectedUnit
				? `${selectedClass} · ${selectedUnit}`
				: selectedClass
					? `${selectedClass} Quiz`
					: 'Graded Quiz')
	);
	const currentQuestionId = $derived(exam.currentQuestion?.questionId?.trim() ?? '');
	const currentStimulusId = $derived(exam.currentQuestion?.stimulusId?.trim() ?? '');
	const currentStimulusScrollTop = $derived(
		currentStimulusId ? (stimulusScrollTopById[currentStimulusId] ?? 0) : 0
	);
	const currentStruck = $derived(
		currentQuestionId ? (struckByQuestionId[currentQuestionId] ?? []) : []
	);
	const currentAnnotations = $derived([
		...(currentQuestionId ? (annotationsByQuestionId[currentQuestionId] ?? []) : []),
		...(currentStimulusId ? (annotationsByStimulusId[currentStimulusId] ?? []) : [])
	]);
	const currentFlagged = $derived(exam.flaggedIndexes.includes(exam.currentIndex));
	const nextLabel = $derived(
		exam.isLastQuestion
			? exam.canFinish
				? 'Review'
				: 'Loading…'
			: exam.nextQuestionReady
				? 'Next'
				: 'Loading…'
	);
	const coachReviewHref = $derived.by(() => {
		const missedQuestions = exam.questions.flatMap((question, index) => {
			const answer = exam.answers[index];
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
		const unansweredPositions = exam.answers.flatMap((answer, index) =>
			answer ? [] : [index + 1]
		);
		const prompt = [
			'I just finished a graded practice quiz and want to review it with you.',
			`Quiz ID: ${exam.examId}.`,
			`Course: ${selectedClass}. Unit: ${selectedUnit || 'All Units'}.`,
			`Score: ${exam.correctCount}/${exam.requestedCount} (${exam.scorePercent}%).`,
			missedSummary.length
				? `Missed questions:\n${missedSummary.join('\n')}`
				: 'I did not miss any questions.',
			unansweredPositions.length ? `Unanswered positions: ${unansweredPositions.join(', ')}.` : '',
			'Use read_quiz_attempt with the Quiz ID and the missed or unanswered question positions to inspect the canonical questions. Help me identify the concepts I should review and give me a short next-step plan.'
		]
			.filter(Boolean)
			.join('\n');
		return `${resolve('/app/coach')}?prompt=${encodeURIComponent(prompt)}`;
	});

	function setGenerating(value: boolean): void {
		if (isGenerating === value) return;
		isGenerating = value;
	}

	function resetLocalSessionState(): void {
		historyStatus = 'idle';
		historyError = '';
		shareStatus = '';
		shareUrl = '';
		shareSetId = '';
		shareAttachedToGroup = false;
		shareCreating = false;
		shareOpen = false;
		pendingClaimSaved = false;
		struckByQuestionId = {};
		annotationsByQuestionId = {};
		annotationsByStimulusId = {};
		stimulusScrollTopById = {};
		lastSnapshot = null;
	}

	function exitQuiz(): void {
		exitConfirmOpen = false;
		exam.resetRunState();
		resetLocalSessionState();
		lastRequestVersion = requestVersion;
		setGenerating(false);
		onExit?.();
	}

	function requestExit(): void {
		exitConfirmOpen = true;
	}

	function confirmExit(): void {
		exitConfirmOpen = false;
		queueMicrotask(() => exitQuiz());
	}

	function selectionKey(): string {
		return `${selectedClass}::${selectedUnit}::${unitRange?.join(',') ?? ''}`;
	}

	async function startQuiz(): Promise<void> {
		if (!enabled || !selectedClass) return;
		resetLocalSessionState();
		setGenerating(true);
		try {
			await exam.start({
				count,
				questions: initialQuestions?.length ? initialQuestions : undefined,
				meta: {
					apClass: selectedClass,
					unit: selectedUnit || 'All Units',
					kind: 'quiz'
				}
			});
		} finally {
			setGenerating(false);
		}
	}

	async function persistQuizHistory(snapshot: ExamSnapshot): Promise<void> {
		if (historyStatus === 'saving' || historyStatus === 'saved') return;
		const items = snapshot.items.map((item) => ({
			position: item.position,
			questionId: item.questionId,
			selectedAnswer: item.selectedAnswer,
			timeTakenMs: item.timeTakenMs
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
					quizId: snapshot.examId,
					...(sharedSlug ? { sharedSlug } : {}),
					apClass: selectedClass,
					unit: selectedUnit || 'All Units',
					startedAt: snapshot.startedAt,
					items
				})
			});
			const payload = await readJsonOrNull<{ error?: string }>(response);
			if (!response.ok) {
				throw new Error(getResponseMessage(payload, 'Could not save quiz history.'));
			}
			historyStatus = 'saved';
		} catch (error) {
			historyStatus = 'error';
			historyError = error instanceof Error ? error.message : 'Could not save quiz history.';
		}
	}

	function saveAnonymousSharedRun(snapshot: ExamSnapshot): void {
		if (!sharedSlug) return;
		const run: PendingSharedQuizRun = {
			quizId: snapshot.examId,
			sharedSlug,
			apClass: selectedClass,
			unit: selectedUnit || 'All Units',
			startedAt: snapshot.startedAt,
			retryCount: 0,
			items: snapshot.items.map((item) => ({
				position: item.position,
				questionId: item.questionId,
				selectedAnswer: item.selectedAnswer,
				timeTakenMs: item.timeTakenMs
			}))
		};
		if (savePendingSharedQuizRun(run)) {
			pendingClaimSaved = true;
		} else {
			historyError = 'This quiz could not be saved. Please try again after signing up.';
		}
	}

	async function ensureShareUrl(attachToGroup: boolean): Promise<string> {
		if (!canShareQuiz) throw new Error('This quiz is not ready to share yet.');
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

			const questionIds = exam.questions
				.map((question) => question?.questionId?.trim() ?? '')
				.filter(Boolean);
			const response = await apiFetch('/api/shared-practice-sets', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					apClass: selectedClass,
					unit: selectedUnit || 'All Units',
					questionIds,
					...(attachToGroup && groupOrganizationId ? { organizationId: groupOrganizationId } : {})
				})
			});
			const payload = await readJsonOrNull<{
				error?: string;
				sharedQuiz?: { id?: string; url?: string };
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

	function toggleStrike(optionId: string): void {
		if (!currentQuestionId) return;
		const existing = struckByQuestionId[currentQuestionId] ?? [];
		const next = existing.includes(optionId)
			? existing.filter((id) => id !== optionId)
			: [...existing, optionId];
		struckByQuestionId = {
			...struckByQuestionId,
			[currentQuestionId]: next
		};
		if (next.includes(optionId) && exam.currentDraft === optionId) {
			exam.setDraftCurrent(null);
		}
	}

	function addTextAnnotation(input: AddTextAnnotationInput): void {
		const targetId = input.target.kind === 'stimulus' ? currentStimulusId : currentQuestionId;
		if (!targetId) return;
		const annotation = createTextAnnotation(input);
		if (!annotation) return;
		if (input.target.kind === 'stimulus') {
			annotationsByStimulusId = {
				...annotationsByStimulusId,
				[targetId]: [...(annotationsByStimulusId[targetId] ?? []), annotation]
			};
		} else {
			annotationsByQuestionId = {
				...annotationsByQuestionId,
				[targetId]: [...(annotationsByQuestionId[targetId] ?? []), annotation]
			};
		}
	}

	function removeTextAnnotation(annotationId: string): void {
		if (currentQuestionId) {
			annotationsByQuestionId = {
				...annotationsByQuestionId,
				[currentQuestionId]: (annotationsByQuestionId[currentQuestionId] ?? []).filter(
					(annotation) => annotation.id !== annotationId
				)
			};
		}
		if (currentStimulusId) {
			annotationsByStimulusId = {
				...annotationsByStimulusId,
				[currentStimulusId]: (annotationsByStimulusId[currentStimulusId] ?? []).filter(
					(annotation) => annotation.id !== annotationId
				)
			};
		}
	}

	function updateStimulusScroll(scrollTop: number): void {
		if (!currentStimulusId || !Number.isFinite(scrollTop)) return;
		stimulusScrollTopById = {
			...stimulusScrollTopById,
			[currentStimulusId]: Math.max(0, scrollTop)
		};
	}

	onMount(() => {
		mounted = true;
		return () => {
			mounted = false;
			exam.destroy();
		};
	});

	onDestroy(() => {
		exam.destroy();
	});

	$effect(() => {
		if (!enabled || !mounted) return;
		const version = requestVersion;
		const key = selectionKey();
		if (key !== lastSelectionKey) {
			lastSelectionKey = key;
			lastRequestVersion = 0;
			if (exam.status !== 'idle') exam.resetRunState();
			setGenerating(false);
		}
		if (version === 0 || version === lastRequestVersion) return;
		lastRequestVersion = version;
		void startQuiz();
	});
</script>

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

{#if exam.status === 'idle'}
	<EmptyState
		title="No quiz yet"
		description="Choose a course and unit, then generate a quiz."
		imageUrl="/illustrations/books.png"
	/>
{:else if exam.status === 'loading' || exam.status === 'error'}
	<Card.Root class="border-border/70 bg-transparent shadow-none ring-0">
		<Card.Content
			class="flex min-h-40 flex-col items-center justify-center gap-3 px-6 py-12 text-center"
		>
			{#if exam.status === 'loading'}
				<p class="text-lg font-medium text-muted-foreground">Generating your quiz…</p>
				<p class="text-sm text-muted-foreground/80">Loading {exam.requestedCount} questions.</p>
				<Button variant="outline" size="sm" onclick={requestExit}>Leave quiz</Button>
			{:else}
				<p class="text-lg font-medium text-muted-foreground">We couldn’t generate this quiz</p>
				<p class="max-w-sm text-sm text-muted-foreground/80">
					{exam.errorMessage || 'Please try again in a moment.'}
				</p>
				<div class="flex flex-wrap justify-center gap-2">
					<Button onclick={() => void startQuiz()}>Try again</Button>
					<Button variant="outline" onclick={requestExit}>Leave quiz</Button>
				</div>
			{/if}
		</Card.Content>
	</Card.Root>
{:else if exam.status === 'complete'}
	<Card.Root class="border-border/70 bg-card/95 shadow-sm">
		<Card.Content class="space-y-8 px-6 py-10 text-center sm:px-10">
			<div class="space-y-2">
				<p class="text-sm font-medium tracking-wide text-muted-foreground uppercase">
					Quiz complete
				</p>
				<p class="font-display text-6xl font-medium tracking-tight text-foreground">
					{exam.correctCount}
					<span class="text-3xl text-muted-foreground">/ {exam.requestedCount}</span>
				</p>
				<p class="text-sm text-muted-foreground">{exam.scorePercent}% correct</p>
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
						<Button
							variant="outline"
							size="sm"
							onclick={() => {
								if (lastSnapshot) void persistQuizHistory(lastSnapshot);
							}}
						>
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
					<p class="text-xl font-semibold text-emerald-600 dark:text-emerald-400">
						{exam.correctCount}
					</p>
					<p class="text-xs text-muted-foreground">Correct</p>
				</div>
				<div class="space-y-1 px-3">
					<p class="text-xl font-semibold text-red-600 dark:text-red-400">
						{exam.incorrectCount}
					</p>
					<p class="text-xs text-muted-foreground">Incorrect</p>
				</div>
				<div class="space-y-1 px-3">
					<p class="text-xl font-semibold text-muted-foreground">{exam.unansweredCount}</p>
					<p class="text-xs text-muted-foreground">Unanswered</p>
				</div>
			</div>

			<div class="flex flex-wrap justify-center gap-2">
				{#if persistHistory && showCoachReview}
					<Button href={coachReviewHref} variant="outline">Review with Pip</Button>
				{/if}
				<Button onclick={() => void startQuiz()}>Try another quiz</Button>
			</div>
		</Card.Content>
	</Card.Root>
{:else if exam.status === 'review'}
	{@const reviewQuestion = exam.currentQuestion ?? exam.questions.find((question) => question)}
	{#if reviewQuestion}
		<FullQuestion
			question={reviewQuestion}
			questionNumber={exam.currentIndex + 1}
			totalQuestions={exam.requestedCount}
			title={quizTitle}
			stage="review"
			reviewTitle={quizTitle}
			navItems={exam.navItems}
			elapsedMs={exam.elapsedMs}
			submitDisabled={!exam.canSubmit}
			onGoTo={(index) => exam.exitReviewTo(index)}
			onSubmit={() => void exam.submit()}
			onClose={requestExit}
		/>
	{/if}
{:else if exam.currentQuestion}
	{#if exam.failedIndexes.length > 0}
		<div
			class="fixed inset-x-0 bottom-16 z-60 mx-auto flex w-[min(40rem,calc(100%-1.5rem))] flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm shadow-lg dark:border-amber-400/30 dark:bg-amber-950/90"
			role="status"
		>
			<p class="text-amber-900 dark:text-amber-100">
				Some questions still need to be loaded before you can finish.
			</p>
			<Button variant="outline" size="sm" onclick={() => void exam.retryFailed()}>
				Retry loading
			</Button>
		</div>
	{/if}

	<FullQuestion
		question={exam.currentQuestion}
		questionNumber={exam.currentIndex + 1}
		totalQuestions={exam.requestedCount}
		title={quizTitle}
		selectedOption={exam.currentDraft}
		flagged={currentFlagged}
		struckOptionIds={currentStruck}
		textAnnotations={currentAnnotations}
		stimulusScrollTop={currentStimulusScrollTop}
		onStimulusScroll={updateStimulusScroll}
		onAddTextAnnotation={addTextAnnotation}
		onRemoveTextAnnotation={removeTextAnnotation}
		navItems={exam.navItems}
		elapsedMs={exam.elapsedMs}
		isLastQuestion={exam.isLastQuestion}
		nextDisabled={exam.isLastQuestion ? !exam.canFinish : !exam.nextQuestionReady}
		prevDisabled={exam.currentIndex === 0}
		nextActionLabel={nextLabel}
		onSelect={(id) => exam.setDraftCurrent(id)}
		onToggleFlag={() => exam.toggleFlag()}
		onToggleStrike={toggleStrike}
		onPrev={() => exam.prev()}
		onNext={() => exam.next()}
		onGoTo={(index) => exam.goTo(index)}
		onEnterReview={() => exam.enterReview()}
		reviewPageDisabled={!exam.canFinish}
		onClose={requestExit}
	/>
{/if}

<AlertDialog.Root bind:open={exitConfirmOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Leave this quiz?</AlertDialog.Title>
			<AlertDialog.Description>
				Your progress on this attempt will not be saved.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Keep practicing</AlertDialog.Cancel>
			<AlertDialog.Action onclick={confirmExit}>Leave quiz</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
