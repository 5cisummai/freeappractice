<script lang="ts">
	import { apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/api.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import {
		appFeedbackSchema,
		type AppFeedbackPayload,
		type CoachFeedbackChatMessage
	} from '$lib/schemas/app-feedback';
	import type { SuperAgentUIMessage } from '$lib/super/agent.server';

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

	type CoachMessageFeedbackDialogProps = {
		open?: boolean;
		messageId: string | null;
		conversationId: string;
		messages: SuperAgentUIMessage[];
		onSubmitted?: (messageId: string) => void;
	};

	let {
		open = $bindable(false),
		messageId,
		conversationId,
		messages,
		onSubmitted
	}: CoachMessageFeedbackDialogProps = $props();

	let submitting = $state(false);
	let submitted = $state(false);
	let error = $state('');
	let fieldErrors = $state<FeedbackFieldErrors>({});
	let feedbackMessage = $state('');
	let includeChatHistory = $state(true);

	function resetForm() {
		feedbackMessage = '';
		includeChatHistory = true;
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

	function coachMessageText(message: SuperAgentUIMessage): string {
		return message.parts
			.filter((part) => part.type === 'text')
			.map((part) => part.text)
			.join('\n')
			.trim();
	}

	function buildChatHistory(): CoachFeedbackChatMessage[] {
		return messages.flatMap((message) => {
			if (message.role !== 'user' && message.role !== 'assistant') return [];
			const content = coachMessageText(message);
			if (!content) return [];
			return [{ role: message.role, content }];
		});
	}

	async function handleSubmit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (submitting || !messageId) return;

		const payload: AppFeedbackPayload = {
			category: 'other',
			message: feedbackMessage,
			coachMessageId: messageId,
			conversationId: conversationId || undefined,
			chatHistory: includeChatHistory ? buildChatHistory() : undefined
		};

		const validation = appFeedbackSchema.safeParse(payload);
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
			onSubmitted?.(messageId);
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
	<Dialog.Content class="sm:max-w-md" showCloseButton={!submitting}>
		<div {@attach initializeDialog}>
			<form class="flex flex-col gap-4" onsubmit={handleSubmit}>
				{#if submitted}
					<Dialog.Header>
						<Dialog.Title>Thanks for the feedback</Dialog.Title>
						<Dialog.Description>
							We use Pip feedback to improve future coaching responses.
						</Dialog.Description>
					</Dialog.Header>
					<Dialog.Footer>
						<Button type="button" onclick={() => (open = false)}>Close</Button>
					</Dialog.Footer>
				{:else}
					<Dialog.Header>
						<Dialog.Title>What was not helpful?</Dialog.Title>
						<Dialog.Description>
							Tell us what missed the mark so we can improve Pip's coaching.
						</Dialog.Description>
					</Dialog.Header>

					<div class="space-y-2">
						<Label for="coach-feedback-message">Message</Label>
						<Textarea
							id="coach-feedback-message"
							bind:value={feedbackMessage}
							required
							rows={5}
							placeholder="What should Pip have done differently?"
							class="min-h-28"
							aria-invalid={Boolean(fieldErrors.message)}
						/>
						{#if fieldErrors.message}
							<p class="text-sm text-destructive">{fieldErrors.message}</p>
						{/if}
					</div>

					<div class="flex items-start gap-3">
						<Checkbox
							id="coach-feedback-include-history"
							bind:checked={includeChatHistory}
							class="mt-0.5"
						/>
						<Label
							for="coach-feedback-include-history"
							class="cursor-pointer text-sm leading-5 font-normal text-foreground"
						>
							Include this chat history
						</Label>
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
						<Button type="submit" disabled={submitting || !messageId}>
							{submitting ? 'Submitting...' : 'Submit'}
						</Button>
					</Dialog.Footer>
				{/if}
			</form>
		</div>
	</Dialog.Content>
</Dialog.Root>
