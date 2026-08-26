<script lang="ts">
	import type { AddTextAnnotationInput, QuestionOption, TextAnnotation } from '$lib/question-bank/mcq/types';
	import AnnotatableRichText from '$lib/components/questions/annotatable-rich-text.svelte';
	import { ANNOTATION_ID_ATTR } from '$lib/components/questions/text-annotation-dom.js';
	import { cn } from '$lib/utils.js';

	let {
		options,
		selectedOption = null,
		struckOptionIds,
		hasCheckedAnswer = false,
		checkedSelection = null,
		correctAnswer,
		onSelect,
		onToggleStrike,
		textAnnotations = [],
		onAddTextAnnotation,
		onRemoveTextAnnotation,
		annotationsDisabled = false,
		showFeedback = false,
		compact = false,
		variant = 'default',
		eliminatorActive = false
	}: {
		options: QuestionOption[];
		selectedOption?: string | null;
		struckOptionIds?: ReadonlySet<string> | string[];
		hasCheckedAnswer?: boolean;
		checkedSelection?: string | null;
		correctAnswer?: string;
		onSelect: (optionId: string | null) => void;
		onToggleStrike?: (optionId: string) => void;
		textAnnotations?: readonly TextAnnotation[];
		onAddTextAnnotation?: (input: AddTextAnnotationInput) => void;
		onRemoveTextAnnotation?: (annotationId: string) => void;
		annotationsDisabled?: boolean;
		showFeedback?: boolean;
		compact?: boolean;
		variant?: 'default' | 'exam';
		eliminatorActive?: boolean;
	} = $props();

	const isExam = $derived(variant === 'exam');

	const struckSet = $derived(
		struckOptionIds instanceof Set
			? struckOptionIds
			: new Set(Array.isArray(struckOptionIds) ? struckOptionIds : [])
	);

	function isStruck(optionId: string): boolean {
		return struckSet.has(optionId);
	}

	function handleSelect(optionId: string): void {
		if (hasCheckedAnswer) return;
		if (eliminatorActive && onToggleStrike) {
			onToggleStrike(optionId);
			return;
		}
		if (isStruck(optionId)) return;
		onSelect(selectedOption === optionId ? null : optionId);
	}

	function handleKeydown(event: KeyboardEvent, optionId: string): void {
		if (event.key === ' ' || event.key === 'Enter') {
			event.preventDefault();
			handleSelect(optionId);
		}
	}

	function handleChoiceClick(optionId: string, event: MouseEvent): void {
		const target = event.target;
		if (target instanceof Element && target.closest(`[${ANNOTATION_ID_ATTR}]`)) return;
		const selection = window.getSelection();
		if (selection?.type === 'Range' && selection.toString().length > 0) return;
		if (event.detail > 1) return;
		handleSelect(optionId);
	}

	function feedbackTone(optionId: string): 'none' | 'selected' | 'correct' | 'incorrect' {
		if (showFeedback && hasCheckedAnswer) {
			if (correctAnswer && optionId === correctAnswer) return 'correct';
			if ((checkedSelection ?? selectedOption) === optionId && optionId !== correctAnswer) {
				return 'incorrect';
			}
		}
		if (selectedOption === optionId && !isStruck(optionId)) return 'selected';
		return 'none';
	}
</script>

<div
	role="radiogroup"
	aria-label="Answer choices"
	class={cn('flex w-full flex-col', isExam ? 'gap-2' : compact ? 'gap-1.5' : 'gap-2')}
>
	{#each options as option (option.id)}
		{@const struck = isStruck(option.id)}
		{@const tone = feedbackTone(option.id)}
		{@const selected = selectedOption === option.id && !struck}
		<div>
			<div
				role="radio"
				aria-checked={selected}
				aria-disabled={(!eliminatorActive && struck) || hasCheckedAnswer}
				tabindex={(!eliminatorActive && struck) || (hasCheckedAnswer && !showFeedback) ? -1 : 0}
				class={cn(
					'flex min-w-0 flex-1 items-center gap-2.5 border text-left transition-colors',
					'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 focus-visible:outline-none',
					isExam
						? 'rounded-lg border px-3 py-2.5'
						: cn('rounded-md border', compact ? 'px-2.5 py-2' : 'px-3 py-2.5'),
					struck && 'opacity-55',
					tone === 'none' &&
						(isExam
							? 'border-border bg-background hover:bg-muted/30'
							: 'border-border bg-card hover:bg-muted/40 dark:hover:bg-muted/20'),
					tone === 'selected' &&
						(isExam
							? 'border-primary ring-1 ring-primary'
							: 'border-primary/50 bg-primary/5 ring-1 ring-primary/30'),
					tone === 'correct' &&
						'border-emerald-500/70 bg-emerald-500/10 ring-1 ring-emerald-500/25',
					tone === 'incorrect' &&
						'border-destructive/60 bg-destructive/10 ring-1 ring-destructive/20',
					struck && 'hover:bg-background',
					!hasCheckedAnswer && 'cursor-pointer',
					hasCheckedAnswer && !showFeedback && 'pointer-events-none opacity-60'
				)}
				onclick={(event) => handleChoiceClick(option.id, event)}
				onkeydown={(event) => handleKeydown(event, option.id)}
			>
				<span
					class={cn(
						'flex shrink-0 select-none items-center justify-center rounded-full border font-sans text-xs font-semibold tabular-nums',
						isExam ? 'size-7' : compact ? 'size-6' : 'size-7',
						struck && 'line-through opacity-70',
						tone === 'selected' && 'border-primary bg-primary text-primary-foreground',
						tone === 'correct' && 'border-emerald-500 bg-emerald-500 text-white',
						tone === 'incorrect' && 'border-destructive bg-destructive text-white',
						tone === 'none' &&
							(isExam
								? 'border-foreground/35 bg-transparent text-foreground'
								: 'border-border bg-muted/40 text-muted-foreground')
					)}
					aria-hidden="true"
				>
					{option.label}
				</span>
				<span
					class={cn(
						'min-w-0 flex-1 font-serif text-foreground',
						isExam ? 'text-sm leading-6' : compact ? 'text-sm leading-5' : 'text-[0.95rem] leading-6',
						struck && 'text-muted-foreground line-through'
					)}
				>
					<AnnotatableRichText
						text={option.text}
						inline
						target={{ kind: 'option', optionId: option.id }}
						annotations={textAnnotations}
						disabled={annotationsDisabled}
						onAddAnnotation={onAddTextAnnotation}
						onRemoveAnnotation={onRemoveTextAnnotation}
						class="[&_*]:font-inherit"
					/>
				</span>
			</div>
		</div>
	{/each}
</div>
