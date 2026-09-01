<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
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

	const presetClass = $derived(page.url.searchParams.get('apClass') ?? '');
	const presetUnit = $derived(page.url.searchParams.get('unit') ?? '');
	const presetMode = $derived(page.url.searchParams.get('mode') ?? '');
	const presetQuestion = $derived(page.url.searchParams.get('questionId') ?? '');

	const runnerKey = $derived(
		data.sharedQuiz
			? `shared:${data.sharedQuiz.slug}`
			: `practice:${presetClass}:${presetUnit}:${presetMode}:${presetQuestion}`
	);

	const runnerInitial = $derived({
		selectedClass: data.sharedQuiz?.apClass ?? presetClass,
		selectedUnit: data.sharedQuiz
			? data.sharedQuiz.unit === 'All Units'
				? ''
				: data.sharedQuiz.unit
			: presetUnit,
		requestVersion: data.sharedQuiz || presetQuestion ? 1 : 0,
		presetQuestionId: data.sharedQuiz ? '' : presetQuestion,
		mode: (!data.sharedQuiz && data.frqEnabled && presetMode === 'frq' ? 'frq' : 'mcq') as
			'mcq' | 'frq'
	});

	type ApiErrorPayload = { error?: string };

	onMount(() => {
		const apClass = page.url.searchParams.get('apClass') ?? '';
		const unit = page.url.searchParams.get('unit') ?? '';
		capturePostHogEvent('practice_page_viewed', {
			ap_class: apClass || undefined,
			page_type: 'app',
			unit: unit || undefined
		});
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

	function handlePracticeEvent(event: PracticeEvent): void {
		if (event.type === 'answered') handleAnswered(event.result);
		if (event.type === 'frq-graded') {
			capturePostHogEvent('frq_progress_saved', {
				ap_class: event.attempt.apClass,
				unit: event.attempt.unit
			});
		}
		if (event.type === 'quiz-exit' && data.sharedQuiz) {
			void goto(resolve('/app/practice'));
		}
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
			{#key runnerKey}
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
			{/key}
		{/if}
	</div>
</PageShell>
