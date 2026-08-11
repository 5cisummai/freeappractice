<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/api.js';
	import PracticeShell from '$lib/components/practice/practice-shell.svelte';
	import type { AnswerResult } from '$lib/questions/types';
	import { toast } from 'svelte-sonner';
	import PageShell from '$lib/components/layout/page-shell.svelte';
	import { capturePostHogEvent } from '$lib/client/posthog-analytics';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';

	let { data } = $props();

	let selectedClass = $state('');
	let selectedUnit = $state('');
	let unitRange = $state<number[] | undefined>(undefined);
	let requestVersion = $state(0);
	let quizRequestVersion = $state(0);
	let quizCount = $state(10);
	let quizGenerating = $state(false);
	let mode = $state<'mcq' | 'frq'>('mcq');
	let practiceMode = $state('unlimited');
	const presetClass = $derived(page.url.searchParams.get('apClass') ?? '');
	const presetUnit = $derived(page.url.searchParams.get('unit') ?? '');
	const presetMode = $derived(page.url.searchParams.get('mode') ?? '');

	type ApiErrorPayload = { error?: string };

	onMount(() => {
		if (!presetClass) return;
		selectedClass = presetClass;
		selectedUnit = presetUnit;
		if (data.frqEnabled && presetMode === 'frq') mode = 'frq';
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
					attemptId: crypto.randomUUID(),
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
				attemptId: crypto.randomUUID(),
				questionId,
				selectedAnswer: result.selectedAnswer,
				timeTakenMs: result.timeTakenMs,
				displayedVariant: result.displayedVariant,
				experimentKey: result.experimentKey,
				experimentVersion: result.experimentVersion
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
</script>

<svelte:head>
	<title>Practice – Free AP Practice</title>
</svelte:head>

<PageShell title="Practice" description="Select a course and unit, then generate a question.">
	<div class="mx-auto max-w-250">
		<Tabs.Root bind:value={practiceMode} class="space-y-6">
			<Tabs.List aria-label="Practice modes" class="h-auto w-full max-w-md justify-start gap-1">
				<Tabs.Trigger value="unlimited">Unlimited practice</Tabs.Trigger>
				<Tabs.Trigger value="graded">
					Graded quizzes
					<Badge variant="default">New</Badge>
				</Tabs.Trigger>
			</Tabs.List>

			<Tabs.Content value="unlimited">
				<PracticeShell
					bind:selectedClass
					bind:selectedUnit
					bind:unitRange
					bind:requestVersion
					bind:mode
					showFirstUseHints
					allowFrq={data.frqEnabled && data.frqCourses.includes(selectedClass)}
					isPersonalizedTutor={data.isPersonalizedTutor}
					practiceExperiment={data.practiceExperiment}
					onAnswered={handleAnswered}
					onFrqGraded={handleFrqGraded}
				/>
			</Tabs.Content>

			<Tabs.Content value="graded" aria-label="Graded quizzes">
				<PracticeShell
					bind:selectedClass
					bind:selectedUnit
					bind:unitRange
					bind:requestVersion={quizRequestVersion}
					bind:count={quizCount}
					bind:quizGenerating
					quizMode
					allowFrq={false}
				/>
			</Tabs.Content>
		</Tabs.Root>
	</div>
</PageShell>
