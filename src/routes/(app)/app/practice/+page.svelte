<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/api.js';
	import QuestionShell from '$lib/components/question-shell.svelte';
	import type { AnswerResult } from '$lib/components/question-card.svelte';
	import { toast } from 'svelte-sonner';
	import { unitForProgress } from '$lib/catalog/custom-unit';
	import PageShell from '$lib/components/page-shell.svelte';

	let selectedClass = $state('');
	let selectedUnit = $state('');
	let customTopic = $state('');
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
			toast.error(error instanceof Error ? error.message : fallbackMessage, {
				id: 'practice-sync-error'
			});
		}
	}

	function handleAnswered(result: AnswerResult) {
		const apClass = result.apClass.trim() || selectedClass.trim();
		const questionId = result.questionId?.trim();
		const unit = result.unit.trim() || unitForProgress(selectedUnit, customTopic);

		if (!apClass || !questionId) return;

		void syncAttempt(
			'/api/me/record-attempt',
			{
				questionId,
				apClass,
				unit,
				selectedAnswer: result.selectedAnswer,
				wasCorrect: result.isCorrect,
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
			bind:customTopic
			bind:requestVersion
			onAnswered={handleAnswered}
		/>
	</div>
</PageShell>
