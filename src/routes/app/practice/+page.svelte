<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/api.js';
	import PracticeRunner, {
		type PracticeEvent
	} from '$lib/components/practice/practice-shell.svelte';
	import type { AnswerResult } from '$lib/question-bank/mcq/types';
	import { toast } from 'svelte-sonner';
	import PageShell from '$lib/components/layout/page-shell.svelte';
	import { capturePostHogEvent } from '$lib/client/posthog-analytics';

	let { data } = $props();

	let selectedClass = $state('');
	let selectedUnit = $state('');
	let unitRange = $state<number[] | undefined>(undefined);
	let requestVersion = $state(0);
	let presetQuestionId = $state('');
	let mode = $state<'mcq' | 'frq'>('mcq');
	const presetClass = $derived(page.url.searchParams.get('apClass') ?? '');
	const presetUnit = $derived(page.url.searchParams.get('unit') ?? '');
	const presetMode = $derived(page.url.searchParams.get('mode') ?? '');
	const presetQuestion = $derived(page.url.searchParams.get('questionId') ?? '');

	type ApiErrorPayload = { error?: string };

	let initialized = $state(false);
	let sharedQuizSlug = $state<string | null>(null);
	const runnerInitial = $derived({
		selectedClass,
		selectedUnit,
		unitRange,
		requestVersion,
		presetQuestionId,
		mode
	});

	$effect(() => {
		if (data.sharedQuiz) {
			if (data.sharedQuiz.slug === sharedQuizSlug) return;
			sharedQuizSlug = data.sharedQuiz.slug;
			selectedClass = data.sharedQuiz.apClass;
			selectedUnit = data.sharedQuiz.unit === 'All Units' ? '' : data.sharedQuiz.unit;
			requestVersion += 1;
			return;
		}
		sharedQuizSlug = null;
		if (initialized) return;
		initialized = true;
		selectedClass = presetClass;
		selectedUnit = presetUnit;
		presetQuestionId = presetQuestion;
		if (data.frqEnabled && presetMode === 'frq') mode = 'frq';
		if (presetQuestion) requestVersion = 1;
	});

	async function syncAttempt(
		path: string,
		body: Record<string, unknown>,
		fallbackMessage: string
	): Promise<void> {
		try {
			const response = await apiFetch(path, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			if (!response.ok) {
				const payload = await readJsonOrNull<ApiErrorPayload>(response);
				throw new Error(getResponseMessage(payload, fallbackMessage));
			}
		} catch (error) {
			capturePostHogEvent('practice_progress_save_failed', {
				endpoint: 'record_attempt'
			});
			toast.error(error instanceof Error ? error.message : fallbackMessage, {
				id: 'practice-sync-error'
			});
		}
	}

	function handleAnswered(result: AnswerResult) {
		const questionId = result.questionId?.trim();

		if (!questionId) return;

		void syncAttempt(
			'/api/me/record-attempt',
			{
				attemptId: crypto.randomUUID(),
				questionId,
				selectedAnswer: result.selectedAnswer,
				timeTakenMs: result.timeTakenMs
			},
			'Could not save this attempt to your progress history.'
		);
	}

	function handleFrqGraded(): void {
		capturePostHogEvent('frq_progress_saved', {
			ap_class: selectedClass,
			unit: selectedUnit
		});
	}

	function handlePracticeEvent(event: PracticeEvent): void {
		if (event.type === 'selection-change') {
			selectedClass = event.selectedClass;
			selectedUnit = event.selectedUnit;
		}
		if (event.type === 'mode-change') mode = event.mode;
		if (event.type === 'answered') handleAnswered(event.result);
		if (event.type === 'frq-graded') handleFrqGraded();
	}
</script>

<svelte:head>
	<title>Practice | Free AP Practice</title>
</svelte:head>

<PageShell title="Practice" description="Select a course and unit, then generate a question.">
	<div class="mx-auto max-w-250">
		{#if data.sharedQuizError}
			<div class="rounded-xl border border-border/70 bg-card p-8 text-center">
				<h2 class="text-xl font-semibold">Shared quiz unavailable</h2>
				<p class="mt-2 text-sm text-muted-foreground">{data.sharedQuizError}</p>
				<a
					class="mt-4 inline-flex text-sm font-medium text-primary hover:underline"
					href={resolve('/app/practice')}>Start regular practice</a
				>
			</div>
		{:else}
			<PracticeRunner
				initial={runnerInitial}
				capabilities={{
					frqCourses: data.frqEnabled ? data.frqCourses : [],
					tutorMode: !data.assistantFeaturesEnabled
						? 'hidden'
						: data.isPersonalizedTutor
							? 'personalized'
							: 'free',
					showFirstUseHints: true
				}}
				quiz={{ persistHistory: true, sharedQuiz: data.sharedQuiz }}
				onEvent={handlePracticeEvent}
			/>
		{/if}
	</div>
</PageShell>
