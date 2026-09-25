<script lang="ts">
	import RichText from '$lib/components/content/rich-text.svelte';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { cn } from '$lib/utils.js';
	import {
		FRQ_ESSAY_RESPONSE_ID,
		type FrqGrade,
		type FrqResponseMode,
		type PublicFrqQuestion
	} from '$lib/question-bank/frq/types';

	type Props = {
		question: PublicFrqQuestion;
		responses: Record<string, string>;
		grade?: FrqGrade | null;
		disabled?: boolean;
		onUpdate: (responseId: string, value: string) => void;
	};

	let { question, responses, grade, disabled = false, onUpdate }: Props = $props();

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
	const essayPoints = $derived(
		grade?.parts.reduce(
			(result, part) => ({
				points: result.points + part.points,
				available: result.available + part.pointsAvailable
			}),
			{ points: 0, available: 0 }
		) ?? { points: 0, available: 0 }
	);

	function write(responseId: string, event: Event): void {
		const target = event.currentTarget;
		if (!(target instanceof HTMLTextAreaElement)) return;
		onUpdate(responseId, target.value);
	}

	function gradeForPart(partId: string) {
		return grade?.parts.find((part) => part.id === partId);
	}

	function feedbackColor(points: number, available: number): string {
		if (points >= available)
			return 'border-emerald-500/60 bg-emerald-500/10 dark:bg-emerald-500/10';
		if (points <= 0) return 'border-destructive/60 bg-destructive/10 dark:bg-destructive/10';
		return 'border-amber-500/60 bg-amber-400/15 dark:bg-amber-500/10';
	}
</script>

<div class="space-y-5">
	{#if mode === 'essay'}
		<div class="space-y-2">
			{#each question.parts as part (part.id)}
				<div class="flex items-start justify-between gap-3">
					<p class="text-sm leading-6 text-foreground/80">
						<span class="font-medium text-foreground">{part.label}) </span>
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
			class={cn(
				'min-h-48 resize-y text-sm leading-6',
				grade && feedbackColor(essayPoints.points, essayPoints.available)
			)}
		/>
		{#if grade}
			<div class="space-y-3" aria-label="Feedback by rubric part">
				{#each grade.parts as part (part.id)}
					<div class="rounded-xl border border-border/70 bg-muted/20 p-4">
						<div class="flex flex-wrap items-center justify-between gap-2">
							<p class="text-sm font-medium">{part.label} feedback</p>
							<p class="text-sm font-semibold tabular-nums">
								{part.points}/{part.pointsAvailable}
							</p>
						</div>
						<p class="mt-1 text-sm leading-6 text-muted-foreground">{part.feedback}</p>
					</div>
				{/each}
			</div>
		{/if}
	{:else}
		{#each question.parts as part (part.id)}
			{@const partGrade = gradeForPart(part.id)}
			<div class="space-y-2">
				<div class="flex items-start justify-between gap-3">
					<div class="flex min-w-0 items-start gap-2">
						<span
							class="shrink-0 font-serif text-[0.925rem] leading-7 font-semibold text-foreground"
							>{part.label})</span
						>
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
					class={cn(
						'min-h-32 resize-y text-sm leading-6',
						partGrade && feedbackColor(partGrade.points, partGrade.pointsAvailable)
					)}
				/>
				{#if partGrade}
					<div class="rounded-xl border border-border/70 bg-muted/20 p-4">
						<div class="flex flex-wrap items-center justify-between gap-2">
							<p class="text-sm font-medium">{part.label} feedback</p>
							<p class="text-sm font-semibold tabular-nums">
								{partGrade.points}/{partGrade.pointsAvailable}
							</p>
						</div>
						<p class="mt-1 text-sm leading-6 text-muted-foreground">{partGrade.feedback}</p>
					</div>
				{/if}
			</div>
		{/each}
	{/if}
</div>
