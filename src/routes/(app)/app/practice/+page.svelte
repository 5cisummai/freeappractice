<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/api.js';
	import QuestionShell from '$lib/components/questions/question-shell.svelte';
	import type { AnswerResult } from '$lib/questions/types';
	import { toast } from 'svelte-sonner';
	import PageShell from '$lib/components/layout/page-shell.svelte';
	import { capturePostHogEvent } from '$lib/client/posthog-analytics';

	let selectedClass = $state('');
	let selectedUnit = $state('');
	let requestVersion = $state(0);
	const presetClass = $derived(page.url.searchParams.get('apClass') ?? '');
	const presetUnit = $derived(page.url.searchParams.get('unit') ?? '');

	type ApiErrorPayload = { error?: string };

	onMount(() => {
		if (!presetClass) return;
		selectedClass = presetClass;
		selectedUnit = presetUnit;
		requestVersion = 1;
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

		if (result.displayedVariant === 'multi_attempt_hints') {
			void syncAttempt(
				'/api/me/record-attempt',
				{
					questionId,
					answers: result.answers ?? [],
					terminalOutcome: result.terminalOutcome,
					hintsShown: result.hintsShown,
					displayedVariant: result.displayedVariant,
					experimentKey: result.experimentKey,
					experimentVersion: result.experimentVersion,
					timeTakenMs: result.timeTakenMs,
					selectedAnswer: result.selectedAnswer
				},
				'Could not save this attempt to your progress history.'
			);
			return;
		}

		void syncAttempt(
			'/api/me/record-attempt',
			{
				questionId,
				selectedAnswer: result.selectedAnswer,
				timeTakenMs: result.timeTakenMs
			},
			'Could not save this attempt to your progress history.'
		);
	}
</script>

<svelte:head>
	<title>Practice – Free AP Practice</title>
</svelte:head>

<PageShell title="Practice" description="Select a course and unit, then generate a question.">
	<div class="mx-auto max-w-250">
		<QuestionShell
			bind:selectedClass
			bind:selectedUnit
			bind:requestVersion
			onAnswered={handleAnswered}
		/>
	</div>
</PageShell>
