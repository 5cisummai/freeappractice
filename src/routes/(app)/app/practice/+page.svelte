<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { auth, apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/auth.svelte.js';
	import QuestionCard, {
		type AnswerResult,
		type FRQAnswerResult
	} from '$lib/components/question-card.svelte';
	import QuestionSelector from '$lib/components/question-selector.svelte';
	import { toast } from 'svelte-sonner';

	let selectedClass = $state('');
	let selectedUnit = $state('');
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
				unit: selectedUnit,
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
				unit: selectedUnit,
				aiScore: result.aiScore,
				pointsEarned: result.pointsEarned,
				totalPoints: result.totalPoints,
				timeTakenMs: result.timeTakenMs
			},
			'Could not save this FRQ result to your progress history.'
		);
	}
</script>

<div class="mx-auto w-full max-w-5xl space-y-8 px-5 py-8 sm:px-8 lg:px-10">
	<div class="space-y-1">
		<h1 class="text-2xl font-semibold tracking-tight">Practice</h1>
		<p class="text-sm text-muted-foreground">Select a course and unit, then generate a question.</p>
	</div>

	<div class="mx-auto max-w-250 space-y-6">
		<QuestionSelector
			bind:selectedClass
			bind:selectedUnit
			bind:questionType
			onSelectionChange={handleSelectionChange}
			onTypeChange={handleTypeChange}
			onGenerate={handleGenerate}
		/>
		{#if requestVersion > 0}
			{#key `${questionType}:${selectedClass}:${selectedUnit}:${requestVersion}`}
				<QuestionCard
					mode={questionType}
					{selectedClass}
					{selectedUnit}
					{requestVersion}
					onAnswered={handleAnswered}
					onFRQAnswered={handleFRQAnswered}
				/>
			{/key}
		{/if}
	</div>
</div>
