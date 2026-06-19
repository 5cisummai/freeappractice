<script lang="ts">
	import RichText from '$lib/components/rich-text.svelte';
	import { cn } from '$lib/utils.js';
	import type { QuestionOption } from '$lib/types/question';

	let {
		options,
		selectedOption = null,
		hasCheckedAnswer = false,
		checkedSelection = null,
		correctAnswer,
		onSelect,
		compact = false
	}: {
		options: QuestionOption[];
		selectedOption?: string | null;
		hasCheckedAnswer?: boolean;
		checkedSelection?: string | null;
		correctAnswer?: string;
		onSelect: (optionId: string) => void;
		compact?: boolean;
	} = $props();

	function optionButtonClasses(optionId: string): string {
		if (!hasCheckedAnswer) {
			return selectedOption === optionId
				? 'border-primary/70 bg-primary/8'
				: 'border-border/70 bg-background hover:bg-muted/40';
		}
		if (correctAnswer && optionId === correctAnswer) {
			return 'border-emerald-500/70 bg-emerald-500/10';
		}
		if (checkedSelection === optionId && checkedSelection !== correctAnswer) {
			return 'border-red-500/70 bg-red-500/10';
		}
		return 'border-border/60 bg-background/60 opacity-80';
	}

	function optionBadgeClasses(optionId: string): string {
		if (!hasCheckedAnswer) {
			return selectedOption === optionId
				? 'border-primary bg-primary text-primary-foreground'
				: 'border-border bg-muted/50 text-muted-foreground';
		}
		if (correctAnswer && optionId === correctAnswer) {
			return 'border-emerald-500 bg-emerald-500 text-white';
		}
		if (checkedSelection === optionId && checkedSelection !== correctAnswer) {
			return 'border-red-500 bg-red-500 text-white';
		}
		return 'border-border bg-muted/40 text-muted-foreground';
	}
</script>

<div class="space-y-2" role="radiogroup" aria-label="Answer choices">
	{#each options as option (option.id)}
		<button
			type="button"
			role="radio"
			aria-checked={selectedOption === option.id}
			disabled={hasCheckedAnswer}
			onclick={() => onSelect(option.id)}
			class={cn(
				'w-full rounded-lg border text-left transition-colors',
				compact ? 'px-3 py-2.5' : 'px-4 py-3',
				'focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:outline-none',
				'disabled:cursor-not-allowed disabled:opacity-100',
				optionButtonClasses(option.id)
			)}
		>
			<div class="flex gap-3">
				<span
					class={cn(
						'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
						optionBadgeClasses(option.id)
					)}
				>
					{option.label}
				</span>
				<RichText text={option.text} inline class="text-sm leading-6" />
			</div>
		</button>
	{/each}
</div>
