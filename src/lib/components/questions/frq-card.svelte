<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import RichText from '$lib/components/content/rich-text.svelte';
	import { apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/api.js';
	import { capturePostHogEvent } from '$lib/client/posthog-analytics.js';
	import { resolveEffectiveUnit } from '$lib/catalog/ap-classes';
	import type { FrqAttemptView, FrqGrade, PublicFrqQuestion } from '$lib/frq/types.js';
	import TutorWidget from '$lib/components/questions/tutor-widget.svelte';

	type Props = {
		selectedClass?: string;
		selectedUnit?: string;
		unitRange?: readonly number[];
		requestVersion?: number;
		onGraded?: (attempt: FrqAttemptView) => void;
	};

	let {
		selectedClass = '',
		selectedUnit = '',
		unitRange,
		requestVersion = 0,
		onGraded
	}: Props = $props();

	let question = $state<PublicFrqQuestion | null>(null);
	let responses = $state<Record<string, string>>({});
	let grade = $state<FrqGrade | null>(null);
	let isLoading = $state(false);
	let isGrading = $state(false);
	let errorMessage = $state('');
	let statusMessage = $state('Write your responses, then submit for rubric feedback.');
	let startedAt = $state(0);
	let attemptId = $state('');
	let disagreementReported = $state(false);
	let seenQuestionIds = $state<string[]>([]);

	const draftKey = $derived(question?.questionId ? `frq-draft:${question.questionId}` : '');
	const draftScopeKey = $derived(
		selectedClass ? `frq-latest-draft:${selectedClass}:${selectedUnit || 'all-units'}` : ''
	);
	const hasResponse = $derived(
		Object.values(responses).some((response) => response.trim().length > 0)
	);

	type FrqQuestionResponse = {
		question?: PublicFrqQuestion;
		error?: string;
	};
	type GradeResponse = { attempt?: FrqAttemptView; error?: string };

	function rememberQuestion(questionId: string | undefined): void {
		if (!questionId || seenQuestionIds.includes(questionId)) return;
		seenQuestionIds = [...seenQuestionIds, questionId];
	}

	function restoreDraft(nextQuestion: PublicFrqQuestion): Record<string, string> {
		if (typeof sessionStorage === 'undefined') {
			return Object.fromEntries(nextQuestion.sections.map((section) => [section.id, '']));
		}
		try {
			const saved = JSON.parse(
				sessionStorage.getItem(`frq-draft:${nextQuestion.questionId}`) ?? 'null'
			);
			if (saved && typeof saved === 'object') return saved as Record<string, string>;
		} catch {
			// Ignore stale or malformed drafts.
		}
		return Object.fromEntries(nextQuestion.sections.map((section) => [section.id, '']));
	}

	function restoreLatestDraft(): boolean {
		if (!draftScopeKey || typeof sessionStorage === 'undefined') return false;
		try {
			const saved = JSON.parse(sessionStorage.getItem(draftScopeKey) ?? 'null') as {
				question?: PublicFrqQuestion;
				responses?: Record<string, string>;
			} | null;
			if (!saved?.question || !saved.responses || saved.question.apClass !== selectedClass) {
				return false;
			}
			question = saved.question;
			responses = saved.responses;
			startedAt = Date.now();
			statusMessage = 'Draft restored. Continue writing, then submit for rubric feedback.';
			return true;
		} catch {
			return false;
		}
	}

	function saveDraft(): void {
		if (!draftKey || typeof sessionStorage === 'undefined' || grade) return;
		sessionStorage.setItem(draftKey, JSON.stringify(responses));
		if (draftScopeKey && question) {
			sessionStorage.setItem(draftScopeKey, JSON.stringify({ question, responses }));
		}
	}

	function clearDraft(): void {
		if (typeof sessionStorage === 'undefined') return;
		if (draftKey) sessionStorage.removeItem(draftKey);
		if (draftScopeKey) {
			const saved = sessionStorage.getItem(draftScopeKey);
			if (!saved || saved.includes(question?.questionId ?? ''))
				sessionStorage.removeItem(draftScopeKey);
		}
	}

	function updateResponse(sectionId: string, value: string): void {
		responses[sectionId] = value;
		responses = { ...responses };
		saveDraft();
	}

	async function loadQuestion(): Promise<void> {
		if (!selectedClass) return;
		isLoading = true;
		isGrading = false;
		grade = null;
		attemptId = '';
		disagreementReported = false;
		errorMessage = '';
		statusMessage = 'Loading a written-response task…';
		try {
			const effectiveUnit = resolveEffectiveUnit(selectedClass, selectedUnit, unitRange);
			const response = await apiFetch('/api/question/frq', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					className: selectedClass,
					unit: effectiveUnit,
					excludeQuestionIds: seenQuestionIds
				})
			});
			const payload = await readJsonOrNull<FrqQuestionResponse>(response);
			if (!response.ok || !payload?.question) {
				throw new Error(getResponseMessage(payload, 'Could not load written-response practice.'));
			}
			question = payload.question;
			responses = restoreDraft(payload.question);
			startedAt = Date.now();
			statusMessage = 'Write your responses, then submit for rubric feedback.';
			rememberQuestion(payload.question.questionId);
			capturePostHogEvent('frq_question_loaded', {
				ap_class: selectedClass,
				unit: selectedUnit,
				question_id: payload.question.questionId
			});
		} catch (error) {
			errorMessage =
				error instanceof Error ? error.message : 'Could not load written-response practice.';
			statusMessage = '';
		} finally {
			isLoading = false;
		}
	}

	async function submit(): Promise<void> {
		if (!question || !hasResponse || isGrading || grade) return;
		isGrading = true;
		errorMessage = '';
		statusMessage = 'Grading your response against the course rubric…';
		try {
			const response = await apiFetch('/api/question/frq/grade', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					questionId: question.questionId,
					submissionId: crypto.randomUUID(),
					responses,
					timeTakenMs: Date.now() - startedAt
				})
			});
			const payload = await readJsonOrNull<GradeResponse>(response);
			if (!response.ok || !payload?.attempt) {
				throw new Error(getResponseMessage(payload, 'Could not grade your response.'));
			}
			grade = payload.attempt.grade;
			attemptId = payload.attempt.id;
			statusMessage = `Score: ${grade.pointsEarned}/${grade.pointsAvailable} points (${grade.percentage}%).`;
			clearDraft();
			onGraded?.(payload.attempt);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Could not grade your response.';
			statusMessage = '';
		} finally {
			isGrading = false;
		}
	}

	async function nextQuestion(): Promise<void> {
		if (!grade) clearDraft();
		question = null;
		responses = {};
		grade = null;
		attemptId = '';
		disagreementReported = false;
		await loadQuestion();
	}

	function reportDisagreement(): void {
		if (disagreementReported || !question || !grade || !attemptId) return;
		disagreementReported = true;
		capturePostHogEvent('frq_grade_disagreement_reported', {
			question_id: question.questionId,
			attempt_id: attemptId,
			ap_class: selectedClass,
			unit: selectedUnit,
			points_earned: grade.pointsEarned,
			points_available: grade.pointsAvailable
		});
	}

	onMount(() => {
		if (requestVersion > 0 && !restoreLatestDraft()) void loadQuestion();
	});
</script>

{#if isLoading}
	<div class="rounded-2xl border border-border/70 p-8 text-center text-sm text-muted-foreground">
		Loading written-response practice…
	</div>
{:else if errorMessage}
	<div class="space-y-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
		<p class="text-sm text-destructive">{errorMessage}</p>
		<Button onclick={() => void loadQuestion()}>Try again</Button>
	</div>
{:else if !question}
	<div
		class="rounded-2xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground"
	>
		Select a course and unit, then choose Generate Question to begin.
	</div>
{:else}
	<div class="space-y-5">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div>
				<p class="text-sm font-medium text-primary">Written-response practice</p>
				<p class="text-xs text-muted-foreground">
					{question.apClass} · {question.unit} · {question.totalPoints} points
				</p>
			</div>
			<p class="text-sm text-muted-foreground">{statusMessage}</p>
		</div>

		<div class="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-7">
			<div class="space-y-5">
				<div class="space-y-2">
					<h2 class="font-display text-xl font-medium tracking-tight">Prompt</h2>
					<RichText text={question.prompt} class="leading-7" />
				</div>

				{#if question.materials.length > 0}
					<div class="space-y-3 rounded-xl bg-muted/30 p-4">
						<p class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
							Materials
						</p>
						{#each question.materials as material (material.id)}
							<div class="space-y-1">
								{#if material.title}<p class="text-sm font-medium">{material.title}</p>{/if}
								<RichText text={material.content} class="text-sm leading-6" />
							</div>
						{/each}
					</div>
				{/if}

				<div class="space-y-5">
					{#each question.sections as section (section.id)}
						<div class="space-y-2">
							<div class="flex items-start justify-between gap-3">
								<div class="flex min-w-0 items-start gap-2">
									<span
										class="flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold"
									>
										{section.label}
									</span>
									<RichText text={section.prompt} class="text-sm leading-6" />
								</div>
								<span class="shrink-0 text-xs text-muted-foreground">{section.maxPoints} pts</span>
							</div>
							<Textarea
								value={responses[section.id] ?? ''}
								disabled={Boolean(grade) || isGrading}
								oninput={(event) =>
									updateResponse(section.id, (event.currentTarget as HTMLTextAreaElement).value)}
								placeholder="Write your response here…"
								class="min-h-32 resize-y text-sm leading-6"
							/>
						</div>
					{/each}
				</div>

				<div class="flex flex-wrap justify-end gap-2 border-t border-border/70 pt-5">
					<Button variant="outline" onclick={() => void nextQuestion()} disabled={isGrading}>
						Skip
					</Button>
					{#if grade}
						<Button onclick={() => void nextQuestion()}>Next question</Button>
					{:else}
						<Button onclick={() => void submit()} disabled={!hasResponse || isGrading}>
							{isGrading ? 'Grading…' : 'Submit for feedback'}
						</Button>
					{/if}
				</div>
			</div>
		</div>

		{#if grade}
			<div class="space-y-4 rounded-2xl border border-border/70 bg-muted/20 p-5 sm:p-7">
				<div>
					<p class="text-2xl font-semibold tabular-nums">
						{grade.pointsEarned}/{grade.pointsAvailable}
					</p>
					<p class="text-sm text-muted-foreground">{grade.overallFeedback}</p>
					<Button
						variant="ghost"
						size="sm"
						class="mt-2 px-0 text-muted-foreground hover:text-foreground"
						onclick={reportDisagreement}
						disabled={disagreementReported}
					>
						{disagreementReported ? 'Score feedback recorded' : 'This score seems off'}
					</Button>
				</div>
				<div class="space-y-3">
					{#each grade.criteria as criterion (criterion.criterionId)}
						<div class="rounded-xl border border-border/70 bg-background p-4">
							<div class="flex flex-wrap items-center justify-between gap-2">
								<p class="text-sm font-medium">{criterion.label}</p>
								<p class="text-sm font-semibold tabular-nums">
									{criterion.points}/{criterion.pointsAvailable}
								</p>
							</div>
							<p class="mt-1 text-sm leading-6 text-muted-foreground">{criterion.feedback}</p>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		{#key question.questionId}
			<TutorWidget
				question={question.prompt}
				apClass={question.apClass}
				unit={question.unit}
				questionId={question.questionId}
				frqQuestionId={question.questionId}
				frqAttemptId={attemptId}
				topic={question.formatId}
			/>
		{/key}
	</div>
{/if}
