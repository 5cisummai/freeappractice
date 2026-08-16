<script lang="ts">
	import MessageSquareIcon from '@lucide/svelte/icons/message-square';
	import { apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/api.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { NativeSelect } from '$lib/components/ui/native-select/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import {
		APP_FEEDBACK_CATEGORIES,
		APP_FEEDBACK_CATEGORY_LABELS,
		appFeedbackSchema,
		type AppFeedbackCategory,
		type AppFeedbackPayload
	} from '$lib/schemas/app-feedback';

	type FeedbackField = keyof AppFeedbackPayload;
	type FeedbackFieldErrors = Partial<Record<FeedbackField, string>>;
	type FeedbackApiError = {
		error?: string;
		message?: string;
		details?: {
			fieldErrors?: Partial<Record<FeedbackField, string[]>>;
			formErrors?: string[];
		};
	};

	let open = $state(false);
	let submitting = $state(false);
	let submitted = $state(false);
	let error = $state('');
	let fieldErrors = $state<FeedbackFieldErrors>({});
	let category = $state<AppFeedbackCategory>('general');
	let message = $state('');

	function resetForm() {
		category = 'general';
		message = '';
		error = '';
		fieldErrors = {};
		submitting = false;
		submitted = false;
	}

	function initializeDialog() {
		resetForm();
	}

	function setFieldErrors(errors: Partial<Record<FeedbackField, string[]>>) {
		const nextErrors: FeedbackFieldErrors = {};
		for (const [field, messages] of Object.entries(errors) as [FeedbackField, string[]][]) {
			if (messages?.[0]) {
				nextErrors[field] = messages[0];
			}
		}
		fieldErrors = nextErrors;
	}

	function applyApiErrors(result: FeedbackApiError | null) {
		const apiFieldErrors = result?.details?.fieldErrors;
		if (apiFieldErrors) {
			setFieldErrors(apiFieldErrors);
		}

		const formError = result?.details?.formErrors?.[0];
		error = formError || getResponseMessage(result, 'Failed to submit feedback.');
	}

	async function handleSubmit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (submitting) return;

		const validation = appFeedbackSchema.safeParse({ category, message });
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
			const response = await apiFetch('/api/feedback', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(validation.data)
			});

			const result = await readJsonOrNull<FeedbackApiError>(response);
			if (!response.ok) {
				applyApiErrors(result);
				return;
			}

			submitted = true;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not submit feedback.';
		} finally {
			submitting = false;
		}
	}
</script>

<Dialog.Root
	bind:open
	onOpenChange={(nextOpen) => {
		if (!nextOpen) resetForm();
	}}
>
	<Sidebar.MenuItem>
		<Dialog.Trigger>
			{#snippet child({ props })}
				<Sidebar.MenuButton tooltipContent="Feedback" {...props}>
					<MessageSquareIcon />
					<span>Feedback</span>
				</Sidebar.MenuButton>
			{/snippet}
		</Dialog.Trigger>
	</Sidebar.MenuItem>

	<Dialog.Content class="sm:max-w-md" showCloseButton={!submitting}>
		<div {@attach initializeDialog}>
			<form class="flex flex-col gap-4" onsubmit={handleSubmit}>
				{#if submitted}
					<Dialog.Header>
						<Dialog.Title>Thanks for your feedback</Dialog.Title>
						<Dialog.Description>
							We read every submission and use it to improve Free AP Practice.
						</Dialog.Description>
					</Dialog.Header>
					<Dialog.Footer>
						<Button type="button" onclick={() => (open = false)}>Close</Button>
					</Dialog.Footer>
				{:else}
					<Dialog.Header>
						<Dialog.Title>Send feedback</Dialog.Title>
						<Dialog.Description>
						Tell us what's working, what's confusing, or what you'd like to see next.
						</Dialog.Description>
					</Dialog.Header>

					<div class="space-y-2">
						<Label for="feedback-category">Category</Label>
						<NativeSelect
							id="feedback-category"
							bind:value={category}
							class="w-full"
							aria-invalid={Boolean(fieldErrors.category)}
						>
							{#each APP_FEEDBACK_CATEGORIES as value (value)}
								<option value={value}>{APP_FEEDBACK_CATEGORY_LABELS[value]}</option>
							{/each}
						</NativeSelect>
						{#if fieldErrors.category}
							<p class="text-sm text-destructive">{fieldErrors.category}</p>
						{/if}
					</div>

					<div class="space-y-2">
						<Label for="feedback-message">Message</Label>
						<Textarea
							id="feedback-message"
							bind:value={message}
							required
							rows={5}
							placeholder="Share your feedback..."
							class="min-h-28"
							aria-invalid={Boolean(fieldErrors.message)}
						/>
						{#if fieldErrors.message}
							<p class="text-sm text-destructive">{fieldErrors.message}</p>
						{/if}
					</div>

					{#if error}
						<p class="text-sm text-destructive">{error}</p>
					{/if}

					<Dialog.Footer>
						<Button
							type="button"
							variant="outline"
							onclick={() => (open = false)}
							disabled={submitting}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={submitting}>
							{submitting ? 'Submitting...' : 'Submit'}
						</Button>
					</Dialog.Footer>
				{/if}
			</form>
		</div>
	</Dialog.Content>
</Dialog.Root>
