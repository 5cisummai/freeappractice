<script lang="ts">
	import { apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/api.js';
	import type { BugReportContext } from '$lib/questions/types.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { NativeSelect } from '$lib/components/ui/native-select/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import {
		bugReportSchema,
		type BugReportPayload,
		type BugReportSeverity
	} from '$lib/schemas/bug-report';

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

	type BugReportField = Exclude<keyof BugReportPayload, 'metadata'>;
	type BugReportFieldErrors = Partial<Record<BugReportField, string>>;
	type BugReportApiError = {
		error?: string;
		message?: string;
		details?: {
			fieldErrors?: Partial<Record<BugReportField, string[]>>;
			formErrors?: string[];
		};
	};

	let {
		open = $bindable(false),
		context = null,
		selectedClass = '',
		selectedUnit = ''
	}: Props = $props();

	let submitting = $state(false);
	let submitted = $state(false);
	let error = $state('');
	let fieldErrors = $state<BugReportFieldErrors>({});
	let form = $state<BugReportForm>(emptyForm());

	function emptyForm(): BugReportForm {
		return { title: '', description: '', steps: '', expected: '', severity: 'medium', email: '' };
	}

	function formFromContext(ctx: BugReportContext): BugReportForm {
		const classLabel = ctx.selectedClass || selectedClass || 'practice';
		const unitLabel = (ctx.selectedUnit ?? selectedUnit ?? '').trim() || 'all-units';
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

	function resetDialogState() {
		form = context ? formFromContext(context) : emptyForm();
		error = '';
		fieldErrors = {};
		submitting = false;
		submitted = false;
	}

	function initializeDialogContent() {
		resetDialogState();
	}

	function buildPayload(): unknown {
		return {
			title: form.title,
			description: form.description,
			steps: form.steps,
			expected: form.expected,
			severity: form.severity,
			email: form.email,
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
		};
	}

	function setFieldErrors(errors: Partial<Record<BugReportField, string[]>>) {
		const nextErrors: BugReportFieldErrors = {};
		for (const [field, messages] of Object.entries(errors) as [BugReportField, string[]][]) {
			if (messages?.[0]) {
				nextErrors[field] = messages[0];
			}
		}
		fieldErrors = nextErrors;
	}

	function applyApiErrors(result: BugReportApiError | null) {
		const apiFieldErrors = result?.details?.fieldErrors;
		if (apiFieldErrors) {
			setFieldErrors(apiFieldErrors);
		}

		const formError = result?.details?.formErrors?.[0];
		error = formError || getResponseMessage(result, 'Failed to submit bug report.');
	}

	async function handleSubmit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (submitting) return;

		const validation = bugReportSchema.safeParse(buildPayload());
		if (!validation.success) {
			const errors = validation.error.flatten();
			setFieldErrors(errors.fieldErrors);
			error = errors.formErrors[0] ?? 'Fix the highlighted fields before submitting.';
			return;
		}

		submitting = true;
		error = '';
		fieldErrors = {};

		try {
			const response = await apiFetch('/api/bug-report', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(validation.data)
			});

			const result = await readJsonOrNull<BugReportApiError>(response);
			if (!response.ok) {
				applyApiErrors(result);
				return;
			}

			submitted = true;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not submit bug report.';
		} finally {
			submitting = false;
		}
	}
</script>

<AlertDialog.Root bind:open>
	<AlertDialog.Content class="max-h-[88vh] w-[min(94vw,56rem)] overflow-hidden">
		<div {@attach initializeDialogContent}>
			<form class="flex max-h-[calc(88vh-3rem)] flex-col gap-5" onsubmit={handleSubmit}>
				<div class="overflow-y-auto pr-1">
					{#if submitted}
						<div class="rounded-lg border border-primary/30 bg-primary/5 p-4" role="status">
							<p class="font-medium">Bug report sent</p>
							<p class="mt-1 text-sm text-muted-foreground">
								Thanks for helping improve Free AP Practice.
							</p>
						</div>
					{:else}
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
								<Input
									id="bug-title"
									bind:value={form.title}
									required
									maxlength={120}
									aria-invalid={Boolean(fieldErrors.title)}
								/>
								{#if fieldErrors.title}
									<p class="text-sm text-destructive">{fieldErrors.title}</p>
								{/if}
							</div>

							<div class="space-y-2 sm:col-span-2">
								<Label for="bug-description">Description</Label>
								<Textarea
									id="bug-description"
									bind:value={form.description}
									required
									rows={3}
									class="min-h-20"
									aria-invalid={Boolean(fieldErrors.description)}
								/>
								{#if fieldErrors.description}
									<p class="text-sm text-destructive">{fieldErrors.description}</p>
								{/if}
							</div>

							<div class="space-y-2">
								<Label for="bug-steps">Steps to reproduce</Label>
								<Textarea
									id="bug-steps"
									bind:value={form.steps}
									rows={3}
									placeholder="Optional, but helpful"
									class="min-h-20"
									aria-invalid={Boolean(fieldErrors.steps)}
								/>
								{#if fieldErrors.steps}
									<p class="text-sm text-destructive">{fieldErrors.steps}</p>
								{/if}
							</div>

							<div class="space-y-2">
								<Label for="bug-expected">Expected result</Label>
								<Textarea
									id="bug-expected"
									bind:value={form.expected}
									rows={3}
									placeholder="What should have happened?"
									class="min-h-20"
									aria-invalid={Boolean(fieldErrors.expected)}
								/>
								{#if fieldErrors.expected}
									<p class="text-sm text-destructive">{fieldErrors.expected}</p>
								{/if}
							</div>

							<div class="space-y-2">
								<Label for="bug-severity">Severity</Label>
								<NativeSelect
									id="bug-severity"
									bind:value={form.severity}
									class="w-full"
									aria-invalid={Boolean(fieldErrors.severity)}
								>
									<option value="low">Low</option>
									<option value="medium">Medium</option>
									<option value="high">High</option>
								</NativeSelect>
								{#if fieldErrors.severity}
									<p class="text-sm text-destructive">{fieldErrors.severity}</p>
								{/if}
							</div>

							<div class="space-y-2">
								<Label for="bug-email">Email</Label>
								<Input
									id="bug-email"
									type="email"
									bind:value={form.email}
									placeholder="Optional"
									aria-invalid={Boolean(fieldErrors.email)}
								/>
								{#if fieldErrors.email}
									<p class="text-sm text-destructive">{fieldErrors.email}</p>
								{/if}
							</div>
						</div>

						{#if error}
							<p class="mt-4 text-sm text-destructive">{error}</p>
						{/if}
					{/if}
				</div>

				<AlertDialog.Footer class="shrink-0">
					{#if submitted}
						<Button type="button" onclick={() => (open = false)}>Close</Button>
					{:else}
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
					{/if}
				</AlertDialog.Footer>
			</form>
		</div>
	</AlertDialog.Content>
</AlertDialog.Root>
