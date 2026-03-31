<script lang="ts">
	import { apiFetch } from '$lib/client/auth.svelte.js';
	import type { BugReportContext } from '$lib/components/question-card.svelte';
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

	type Props = {
		open?: boolean;
		context?: BugReportContext | null;
		selectedClass?: string;
		selectedUnit?: string;
	};

	let {
		open = $bindable(false),
		context = null,
		selectedClass = '',
		selectedUnit = ''
	}: Props = $props();

	let submitting = $state(false);
	let error = $state('');
	let form = $state<BugReportForm>(emptyForm());

	function emptyForm(): BugReportForm {
		return { title: '', description: '', steps: '', expected: '', severity: 'medium', email: '' };
	}

	function formFromContext(ctx: BugReportContext): BugReportForm {
		const classLabel = ctx.selectedClass || selectedClass || 'practice';
		const unitLabel = ctx.selectedUnit || selectedUnit || 'the current unit';
		const questionLabel = ctx.questionNumber
			? `Question ${ctx.questionNumber}`
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

	$effect(() => {
		if (open) {
			form = context ? formFromContext(context) : emptyForm();
			error = '';
			submitting = false;
		}
	});

	async function handleSubmit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		submitting = true;
		error = '';

		try {
			const response = await apiFetch('/api/bug-report', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: form.title.trim(),
					description: form.description.trim(),
					steps: form.steps.trim() || undefined,
					expected: form.expected.trim() || undefined,
					severity: form.severity,
					email: form.email.trim() || undefined,
					metadata: context
						? {
								questionId: context.questionId,
								questionNumber: context.questionNumber,
								selectedClass: context.selectedClass ?? selectedClass,
								selectedUnit: context.selectedUnit ?? selectedUnit,
								prompt: context.prompt,
								correctAnswer: context.correctAnswer,
								hasStimulus: context.hasStimulus
							}
						: { selectedClass, selectedUnit }
				})
			});

			const result = (await response.json().catch(() => ({}))) as Record<string, unknown>;
			if (!response.ok) {
				throw new Error(
					typeof result.error === 'string' ? result.error : 'Failed to submit bug report.'
				);
			}

			open = false;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not submit bug report.';
		} finally {
			submitting = false;
		}
	}
</script>

<AlertDialog.Root bind:open>
	<AlertDialog.Content class="max-h-[88vh] w-[min(94vw,56rem)] overflow-hidden">
		<form class="flex max-h-[calc(88vh-3rem)] flex-col gap-5" onsubmit={handleSubmit}>
			<div class="overflow-y-auto pr-1">
				<AlertDialog.Header class="items-start text-left">
					<div class="space-y-2">
						<AlertDialog.Title class="text-xl">Report a bug</AlertDialog.Title>
						<AlertDialog.Description>
							Share what went wrong so we can reproduce and fix it.
						</AlertDialog.Description>
					</div>
					{#if context}
						<div
							class="w-full rounded-lg border border-border/70 bg-muted/40 p-3 text-sm text-muted-foreground"
						>
							<p class="font-medium text-foreground">Question context</p>
							<p>
								Question {context.questionNumber}
								{#if context.selectedClass}
									in {context.selectedClass}
								{/if}
								{#if context.selectedUnit}
									- {context.selectedUnit}
								{/if}
							</p>
							{#if context.correctAnswer}
								<p>Correct answer: {context.correctAnswer}</p>
							{/if}
						</div>
					{/if}
				</AlertDialog.Header>

				<div class="grid gap-4 sm:grid-cols-2">
					<div class="space-y-2 sm:col-span-2">
						<Label for="bug-title">Title</Label>
						<Input id="bug-title" bind:value={form.title} required maxlength={120} />
					</div>

					<div class="space-y-2 sm:col-span-2">
						<Label for="bug-description">Description</Label>
						<Textarea
							id="bug-description"
							bind:value={form.description}
							required
							rows={3}
							class="min-h-20"
						/>
					</div>

					<div class="space-y-2">
						<Label for="bug-steps">Steps to reproduce</Label>
						<Textarea
							id="bug-steps"
							bind:value={form.steps}
							rows={3}
							placeholder="Optional, but helpful"
							class="min-h-20"
						/>
					</div>

					<div class="space-y-2">
						<Label for="bug-expected">Expected result</Label>
						<Textarea
							id="bug-expected"
							bind:value={form.expected}
							rows={3}
							placeholder="What should have happened?"
							class="min-h-20"
						/>
					</div>

					<div class="space-y-2">
						<Label for="bug-severity">Severity</Label>
						<NativeSelect id="bug-severity" bind:value={form.severity} class="w-full">
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
							bind:value={form.email}
							placeholder="Optional"
						/>
					</div>
				</div>

				{#if error}
					<p class="mt-4 text-sm text-destructive">{error}</p>
				{/if}
			</div>

			<AlertDialog.Footer class="shrink-0">
				<Button
					type="button"
					variant="outline"
					onclick={() => (open = false)}
					disabled={submitting}
				>
					Cancel
				</Button>
				<Button type="submit" disabled={submitting}>
					{submitting ? 'Submitting...' : 'Submit report'}
				</Button>
			</AlertDialog.Footer>
		</form>
	</AlertDialog.Content>
</AlertDialog.Root>
