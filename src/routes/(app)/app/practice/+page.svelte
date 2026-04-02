<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { auth, apiFetch } from '$lib/client/auth.svelte.js';
	import QuestionCard, {
		type AnswerResult,
		type FRQAnswerResult
	} from '$lib/components/question-card.svelte';
	import QuestionSelector from '$lib/components/question-selector.svelte';

	let selectedClass = $state('');
	let selectedUnit = $state('');
	let questionType = $state<'mcq' | 'frq'>('mcq');
	let requestVersion = $state(0);
	const presetClass = $derived(page.url.searchParams.get('apClass') ?? '');
	const presetUnit = $derived(page.url.searchParams.get('unit') ?? '');

	onMount(() => {
		if (!presetClass) return;
		selectedClass = presetClass;
		selectedUnit = presetUnit;
		requestVersion = 1;
	});

	function handleSelectionChange(_cls: string, _unit: string) {
		requestVersion = 0;
	}

	function handleTypeChange(type: 'mcq' | 'frq') {
		questionType = type;
		requestVersion = 0;
	}

	function handleGenerate() {
		requestVersion += 1;
	}

	function handleAnswered(result: AnswerResult) {
		if (!auth.isAuthenticated) return;
		void apiFetch('/api/auth/record-attempt', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				questionId: result.questionId,
				apClass: selectedClass,
				unit: selectedUnit,
				selectedAnswer: result.selectedAnswer,
				wasCorrect: result.isCorrect,
				timeTakenMs: result.timeTakenMs
			})
		}).catch(() => {
			// Non-critical
		});
	}

	async function handleFRQAnswered(result: FRQAnswerResult) {
		if (!auth.isAuthenticated) return;
		try {
			await apiFetch('/api/auth/record-frq-attempt', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					questionId: result.questionId,
					apClass: selectedClass,
					unit: selectedUnit,
					aiScore: result.aiScore,
					pointsEarned: result.pointsEarned,
					totalPoints: result.totalPoints,
					timeTakenMs: result.timeTakenMs
				})
			});
		} catch {
			// Non-critical
		}
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
			<QuestionCard
				mode={questionType}
				{selectedClass}
				{selectedUnit}
				{requestVersion}
				onAnswered={handleAnswered}
				onFRQAnswered={handleFRQAnswered}
			/>
		{/if}
	</div>
</div>
