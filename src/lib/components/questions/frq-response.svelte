<script lang="ts">
	import RichText from '$lib/components/content/rich-text.svelte';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import {
		FRQ_ESSAY_RESPONSE_ID,
		type FrqResponseMode,
		type PublicFrqQuestion
	} from '$lib/question-bank/frq/types';

	type Props = {
		question: PublicFrqQuestion;
		responses: Record<string, string>;
		disabled?: boolean;
		onUpdate: (responseId: string, value: string) => void;
	};

	let { question, responses, disabled = false, onUpdate }: Props = $props();

	function responseMode(mode: FrqResponseMode): FrqResponseMode {
		switch (mode) {
			case 'essay':
			case 'parts':
				return mode;
			default: {
				const exhaustive: never = mode;
				return exhaustive;
			}
		}
	}

	const mode = $derived(responseMode(question.responseMode));

	function write(responseId: string, event: Event): void {
		const target = event.currentTarget;
		if (!(target instanceof HTMLTextAreaElement)) return;
		onUpdate(responseId, target.value);
	}
</script>

<div class="space-y-5">
	{#if mode === 'essay'}
		<div class="space-y-2">
			{#each question.parts as part (part.id)}
				<div class="flex items-start justify-between gap-3">
					<p class="text-sm leading-6 text-foreground/80">
						<span class="font-medium text-foreground">{part.label}.</span>
						{part.prompt}
					</p>
					<span class="shrink-0 text-xs text-muted-foreground">{part.points} pts</span>
				</div>
			{/each}
		</div>
		<Textarea
			value={responses[FRQ_ESSAY_RESPONSE_ID] ?? ''}
			{disabled}
			oninput={(event) => write(FRQ_ESSAY_RESPONSE_ID, event)}
			placeholder="Write your essay here…"
			class="min-h-48 resize-y text-sm leading-6"
		/>
	{:else}
		{#each question.parts as part (part.id)}
			<div class="space-y-2">
				<div class="flex items-start justify-between gap-3">
					<div class="flex min-w-0 items-start gap-2">
						<span
							class="flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold"
						>
							{part.label}
						</span>
						<RichText
							text={part.prompt}
							blocks
							class="font-serif text-[0.925rem] leading-7 text-foreground/80"
						/>
					</div>
					<span class="shrink-0 text-xs text-muted-foreground">{part.points} pts</span>
				</div>
				<Textarea
					value={responses[part.id] ?? ''}
					{disabled}
					oninput={(event) => write(part.id, event)}
					placeholder="Write your response here…"
					class="min-h-32 resize-y text-sm leading-6"
				/>
			</div>
		{/each}
	{/if}
</div>
