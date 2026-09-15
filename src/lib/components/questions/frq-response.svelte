<script lang="ts">
	import RichText from '$lib/components/content/rich-text.svelte';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import type { FrqSection, PublicFrqQuestion } from '$lib/question-bank/frq/types';

	type Props = {
		question: PublicFrqQuestion;
		responses: Record<string, string>;
		disabled?: boolean;
		onUpdate: (sectionId: string, value: string) => void;
	};

	let { question, responses, disabled = false, onUpdate }: Props = $props();

	function isTextSection(section: FrqSection): section is FrqSection & { responseKind: 'text' } {
		switch (section.responseKind) {
			case 'text':
				return true;
			default: {
				const _exhaustive: never = section.responseKind;
				return _exhaustive;
			}
		}
	}
</script>

<div class="space-y-5">
	{#each question.sections as section (section.id)}
		<div class="space-y-2">
			<div class="flex items-start justify-between gap-3">
				<div class="flex min-w-0 items-start gap-2">
					<span
						class="flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold"
					>
						{section.label}
					</span>
					<RichText
						text={section.prompt}
						blocks
						class="font-serif text-[0.925rem] leading-7 text-foreground/80"
					/>
				</div>
				<span class="shrink-0 text-xs text-muted-foreground">{section.maxPoints} pts</span>
			</div>
			{#if isTextSection(section)}
				<Textarea
					value={responses[section.id] ?? ''}
					{disabled}
					oninput={(event) =>
						onUpdate(section.id, (event.currentTarget as HTMLTextAreaElement).value)}
					placeholder="Write your response here…"
					class="min-h-32 resize-y text-sm leading-6"
				/>
			{/if}
		</div>
	{/each}
</div>
