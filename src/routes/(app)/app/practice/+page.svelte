<script lang="ts">
	import { auth, apiFetch } from '$lib/client/auth.svelte.js';
	import QuestionCard, {
		type AnswerResult,
		type BugReportContext,
		type FRQAnswerResult
	} from '$lib/components/question-card.svelte';
	import QuestionSelector from '$lib/components/question-selector.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { NativeSelect } from '$lib/components/ui/native-select/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';

	type BugReportSeverity = 'low' | 'medium' | 'high';

	type BugReportForm = {
		title: string;
		description: string;
		steps: string;
		expected: string;
		severity: BugReportSeverity;
		email: string;
	};

	let selectedClass = $state('');
	let selectedUnit = $state('');
	let questionType = $state<'mcq' | 'frq'>('mcq');
	let requestVersion = $state(0);
	let bugReportOpen = $state(false);
	let bugReportSubmitting = $state(false);
	let bugReportError = $state('');
	let bugReportContext = $state<BugReportContext | null>(null);
	let bugReportForm = $state<BugReportForm>({
		title: '',
		description: '',
		steps: '',
		expected: '',
		severity: 'medium',
		email: ''
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

	function createBugReportDefaults(context: BugReportContext): BugReportForm {
		const classLabel = context.selectedClass || 'practice';
		const unitLabel = context.selectedUnit || 'the current unit';
		const questionLabel = context.questionNumber
			? `Question ${context.questionNumber}`
			: 'the current question';

		return {
			title: `Bug report: ${questionLabel}`,
			description: `I found an issue while working through ${questionLabel} in ${classLabel} / ${unitLabel}.`,
			steps: '1. Open the question.\n2. Reproduce the issue.\n3. Describe what happened.',
			expected: 'The question should load and behave normally.',
			severity: 'medium',
			email: ''
		};
	}

	function openBugReportDialog(context: BugReportContext) {
		bugReportContext = context;
		bugReportForm = createBugReportDefaults(context);
		bugReportError = '';
		bugReportOpen = true;
	}

	function closeBugReportDialog() {
		bugReportOpen = false;
		bugReportError = '';
	}

	async function handleBugReportSubmit(event: SubmitEvent) {
		event.preventDefault();

		if (!bugReportContext) {
			bugReportError = 'Missing bug report context.';
			return;
		}

		bugReportSubmitting = true;
		bugReportError = '';

		try {
			const response = await apiFetch('/api/bug-report', {
				method: 'POST',
				body: JSON.stringify({
					title: bugReportForm.title.trim(),
					description: bugReportForm.description.trim(),
					steps: bugReportForm.steps.trim() || undefined,
					expected: bugReportForm.expected.trim() || undefined,
					severity: bugReportForm.severity,
					email: bugReportForm.email.trim() || undefined,
					metadata: {
						questionId: bugReportContext.questionId,
						questionNumber: bugReportContext.questionNumber,
						selectedClass: bugReportContext.selectedClass ?? selectedClass,
						selectedUnit: bugReportContext.selectedUnit ?? selectedUnit,
						prompt: bugReportContext.prompt,
						correctAnswer: bugReportContext.correctAnswer,
						hasStimulus: bugReportContext.hasStimulus
					}
				})
			});

			const result = (await response.json().catch(() => ({}))) as Record<string, unknown>;
			if (!response.ok) {
				throw new Error(
					typeof result.error === 'string' ? result.error : 'Failed to submit bug report.'
				);
			}

			closeBugReportDialog();
		} catch (error) {
			bugReportError = error instanceof Error ? error.message : 'Could not submit bug report.';
		} finally {
			bugReportSubmitting = false;
		}
	}
</script>

<div class="mx-auto w-full max-w-7xl space-y-8 px-5 py-8 sm:px-8 lg:px-10">
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
				onReportBug={openBugReportDialog}
			/>
		{/if}
	</div>

	<AlertDialog.Root bind:open={bugReportOpen}>
		<AlertDialog.Content size="sm" class="max-h-[90vh] overflow-y-auto">
			<form class="space-y-5" onsubmit={handleBugReportSubmit}>
				<AlertDialog.Header class="items-start text-left">
					<div class="space-y-2">
						<AlertDialog.Title class="text-xl">Report a bug</AlertDialog.Title>
						<AlertDialog.Description>
							Share what went wrong so we can reproduce and fix it.
						</AlertDialog.Description>
					</div>
					{#if bugReportContext}
						<div
							class="w-full rounded-lg border border-border/70 bg-muted/40 p-3 text-sm text-muted-foreground"
						>
							<p class="font-medium text-foreground">Question context</p>
							<p>
								Question {bugReportContext.questionNumber}
								{#if bugReportContext.selectedClass}
									in {bugReportContext.selectedClass}
								{/if}
								{#if bugReportContext.selectedUnit}
									- {bugReportContext.selectedUnit}
								{/if}
							</p>
							{#if bugReportContext.correctAnswer}
								<p>Correct answer: {bugReportContext.correctAnswer}</p>
							{/if}
						</div>
					{/if}
				</AlertDialog.Header>

				<div class="grid gap-4">
					<div class="space-y-2">
						<Label for="bug-title">Title</Label>
						<Input id="bug-title" bind:value={bugReportForm.title} required maxlength={120} />
					</div>

					<div class="space-y-2">
						<Label for="bug-description">Description</Label>
						<Textarea
							id="bug-description"
							bind:value={bugReportForm.description}
							required
							rows={4}
							class="min-h-24"
						/>
					</div>

					<div class="space-y-2">
						<Label for="bug-steps">Steps to reproduce</Label>
						<Textarea
							id="bug-steps"
							bind:value={bugReportForm.steps}
							rows={4}
							placeholder="Optional, but helpful"
							class="min-h-24"
						/>
					</div>

					<div class="space-y-2">
						<Label for="bug-expected">Expected result</Label>
						<Textarea
							id="bug-expected"
							bind:value={bugReportForm.expected}
							rows={3}
							placeholder="What should have happened?"
							class="min-h-20"
						/>
					</div>

					<div class="grid gap-4 sm:grid-cols-2">
						<div class="space-y-2">
							<Label for="bug-severity">Severity</Label>
							<NativeSelect id="bug-severity" bind:value={bugReportForm.severity} class="w-full">
								<option value="low">Low</option>
								<option value="medium">Medium</option>
								<option value="high">High</option>
							</NativeSelect>
						</div>

						<div class="space-y-2">
							<Label for="bug-email">Email</Label>
							<Input
								id="bug-email"
								type="email"
								bind:value={bugReportForm.email}
								placeholder="Optional"
							/>
						</div>
					</div>
				</div>

				{#if bugReportError}
					<p class="text-sm text-destructive">{bugReportError}</p>
				{/if}

				<AlertDialog.Footer>
					<Button
						type="button"
						variant="outline"
						onclick={closeBugReportDialog}
						disabled={bugReportSubmitting}
					>
						Cancel
					</Button>
					<Button type="submit" disabled={bugReportSubmitting}>
						{bugReportSubmitting ? 'Submitting...' : 'Submit report'}
					</Button>
				</AlertDialog.Footer>
			</form>
		</AlertDialog.Content>
	</AlertDialog.Root>
</div>
