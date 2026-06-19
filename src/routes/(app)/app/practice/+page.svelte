<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { auth } from '$lib/client/auth.svelte.js';
	import { apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/api.js';
	import QuestionCard, {
		type AnswerResult,
		type FRQAnswerResult
	} from '$lib/components/question-card.svelte';
	import QuestionSelector from '$lib/components/question-selector.svelte';
	import { toast } from 'svelte-sonner';
	import { unitForProgress } from '$lib/constants/custom-unit';
	import PageShell from '$lib/components/page-shell.svelte';

	let selectedClass = $state('');
	let selectedUnit = $state('');
	let customTopic = $state('');
	let questionType = $state<'mcq' | 'frq'>('mcq');
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

	function handleSelectionChange() {
		requestVersion = 0;
	}

	function handleTypeChange(type: 'mcq' | 'frq') {
		questionType = type;
		requestVersion = 0;
	}

	function handleGenerate() {
		requestVersion += 1;
	}

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
		if (!auth.isAuthenticated) return;
		void syncAttempt(
			'/api/auth/record-attempt',
			{
				questionId: result.questionId,
				apClass: selectedClass,
				unit: unitForProgress(selectedUnit, customTopic),
				selectedAnswer: result.selectedAnswer,
				wasCorrect: result.isCorrect,
				timeTakenMs: result.timeTakenMs
			},
			'Could not save this attempt to your progress history.'
		);
	}

	async function handleFRQAnswered(result: FRQAnswerResult) {
		if (!auth.isAuthenticated) return;
		await syncAttempt(
			'/api/auth/record-frq-attempt',
			{
				questionId: result.questionId,
				apClass: selectedClass,
				unit: unitForProgress(selectedUnit, customTopic),
				aiScore: result.aiScore,
				pointsEarned: result.pointsEarned,
				totalPoints: result.totalPoints,
				timeTakenMs: result.timeTakenMs
			},
			'Could not save this FRQ result to your progress history.'
		);
	}
</script>

<svelte:head>
	<title>Practice – Free AP Practice</title>
</svelte:head>

<PageShell title="Practice" description="Select a course and unit, then generate a question.">
	<div class="mx-auto max-w-250 space-y-6">
		<QuestionSelector
			bind:selectedClass
			bind:selectedUnit
			bind:customTopic
			bind:questionType
			onSelectionChange={handleSelectionChange}
			onTypeChange={handleTypeChange}
			onGenerate={handleGenerate}
		/>
		{#key `${questionType}:${selectedClass}:${selectedUnit}:${customTopic}:${requestVersion}`}
			<QuestionCard
				mode={questionType}
				{selectedClass}
				{selectedUnit}
				{customTopic}
				{requestVersion}
				onAnswered={handleAnswered}
				onFRQAnswered={handleFRQAnswered}
			/>
		{/key}
	</div>
</PageShell>
