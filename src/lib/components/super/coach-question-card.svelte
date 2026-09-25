<script lang="ts">
	import RichText from '$lib/components/content/rich-text.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import {
		getCoachQuestionToolInput,
		type CoachQuestionToolOutput
	} from '$lib/super/coach-question';

	let {
		input,
		onResolve
	}: {
		input: unknown;
		onResolve: (output: CoachQuestionToolOutput) => Promise<boolean>;
	} = $props();

	const toolInput = $derived(getCoachQuestionToolInput(input));
	let selectedOption = $state('');
	let response = $state('');
	let submitting = $state(false);
	let resolved = $state(false);
	let error = $state('');
	const responseValue = $derived(response.trim() || selectedOption);

	async function finish(output: CoachQuestionToolOutput): Promise<void> {
		if (submitting || resolved) return;
		submitting = true;
		error = '';
		try {
			if (await onResolve(output)) resolved = true;
			else error = 'Could not submit your response. Try again.';
		} finally {
			submitting = false;
		}
	}

	function continueWithResponse(): void {
		if (responseValue) void finish({ status: 'answered', response: responseValue });
	}
</script>

<section
	class="mx-auto mb-3 w-full max-w-3xl overflow-hidden rounded-t-2xl border border-border/70 bg-card"
	aria-label="Pip's question"
>
	<div class="p-3 sm:px-4">
		{#if toolInput}
			<div class="mb-3 text-sm leading-6 text-foreground/90">
				<RichText text={toolInput.question} />
			</div>
			{#if toolInput.options?.length}
				<div class="space-y-0.5">
					{#each toolInput.options as option, index (option)}
						<button
							type="button"
							class="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left text-sm transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
							class:bg-muted={selectedOption === option}
							aria-pressed={selectedOption === option}
							disabled={submitting || resolved}
							onclick={() => {
								selectedOption = option;
								response = '';
							}}
						>
							<span
								class="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-background font-medium text-muted-foreground"
							>
								{String.fromCharCode(65 + index)}
							</span>
							<span class="leading-5">{option}</span>
						</button>
					{/each}
				</div>
			{/if}

			<Textarea
				class="mt-2 min-h-12 bg-background"
				aria-label="Write your response"
				bind:value={response}
				maxlength={1000}
				placeholder={toolInput.options?.length
					? 'Or write your own response…'
					: 'Write your response…'}
				disabled={submitting || resolved}
				rows={2}
			/>

			<footer class="mt-3 flex items-center justify-end gap-2">
				{#if error}<span class="mr-auto text-sm text-destructive" role="alert">{error}</span>{/if}
				<Button
					type="button"
					variant="ghost"
					size="sm"
					disabled={submitting || resolved}
					onclick={() => finish({ status: 'skipped' })}
				>
					Skip
				</Button>
				<Button
					type="button"
					size="sm"
					disabled={submitting || resolved || !responseValue}
					onclick={continueWithResponse}
				>
					{#if submitting}Sending…{:else}Continue{/if}
				</Button>
			</footer>
		{:else}
			<p class="text-sm text-muted-foreground">Pip could not show this question.</p>
			<div class="mt-4 flex justify-end">
				<Button
					variant="ghost"
					disabled={submitting || resolved}
					onclick={() => finish({ status: 'skipped' })}
				>
					Skip
				</Button>
			</div>
		{/if}
	</div>
</section>
