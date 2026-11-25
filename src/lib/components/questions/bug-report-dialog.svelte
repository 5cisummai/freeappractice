<script lang="ts">
	import CheckIcon from '@tabler/icons-svelte/icons/check';
	import InfoIcon from '@tabler/icons-svelte/icons/info-circle';
	import { apiFetch, getResponseMessage, readJsonOrNull } from '#lib/client/api.js';
	import type { BugReportContext } from '#lib/question-bank/mcq/types.js';
	import * as AlertDialog from '#lib/components/ui/alert-dialog/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { NativeSelect } from '#lib/components/ui/native-select/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';
	import * as Tooltip from '#lib/components/ui/tooltip/index.js';
	import {
		bugReportSchema,
		type BugReportPayload,
		type BugReportSeverity
	} from '#lib/schemas/bug-report.js';

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
		selectedCourse?: string;
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
		selectedCourse = '',
		selectedUnit = ''
	}: Props = $props();

	let submitting = $state(false);
	let submitted = $state(false);
	let error = $state('');
	let fieldErrors = $state<BugReportFieldErrors>({});
	let form = $state<BugReportForm>(emptyForm());
	const stepsPlaceholder = '1. Open the question.\n2. Reproduce the issue.\n3. Describe what happened.';

	function emptyForm(): BugReportForm {
		return { title: '', description: '', steps: '', expected: '', severity: 'medium', email: '' };
	}

	function resetDialogState() {
		form = emptyForm();
		if (context) {
			form.title = context.questionNumber
				? `Bug report: Question ${context.questionNumber}`
				: 'Bug report: Current question';
			form.expected = 'The question should load and behave normally.';
		}
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
						selectedCourse: context.selectedCourse ?? selectedCourse,
						selectedUnit: context.selectedUnit ?? selectedUnit,
						prompt: context.prompt,
						correctAnswer: context.correctAnswer,
						hasStimulus: context.hasStimulus
					}
				: { selectedCourse, selectedUnit }
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
								<div class="mb-3 flex w-full items-center gap-1.5 text-sm text-muted-foreground">
									<CheckIcon class="size-4 text-green-600 dark:text-green-400" aria-hidden="true" />
									<span>Question context added</span>
									<Tooltip.Provider>
										<Tooltip.Root>
											<Tooltip.Trigger
												type="button"
												aria-label="Attached question details"
												class="inline-flex size-6 items-center justify-center rounded-sm hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
											>
												<InfoIcon class="size-4" aria-hidden="true" />
											</Tooltip.Trigger>
											<Tooltip.Content sideOffset={4}>
												Question {context.questionNumber}{context.selectedCourse
													? ` in ${context.selectedCourse}`
													: ''}{context.selectedUnit ? ` · ${context.selectedUnit}` : ''}
											</Tooltip.Content>
										</Tooltip.Root>
									</Tooltip.Provider>
								</div>
							{/if}
						</AlertDialog.Header>

						<div class="grid gap-4 sm:grid-cols-2">
							<div class="space-y-2 sm:col-span-2">
								<Label for="bug-title">Title</Label>
								<Input
									id="bug-title"
									bind:value={form.title}
									placeholder="Summarize the issue"
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
									placeholder="What happened?"
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
									placeholder={stepsPlaceholder}
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
