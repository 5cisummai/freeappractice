<script lang="ts">
	import RichText from '$lib/components/rich-text.svelte';
	import * as Resizable from '$lib/components/ui/resizable/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { cn } from '$lib/utils.js';
	import type { FRQGrade, FRQQuestion } from '$lib/types/question';

	let {
		question,
		responses,
		hasSubmitted = false,
		grade = null,
		isMobileViewport = false,
		expanded = false,
		onResponseChange
	}: {
		question: FRQQuestion;
		responses: Record<string, string>;
		hasSubmitted?: boolean;
		grade?: FRQGrade | null;
		isMobileViewport?: boolean;
		expanded?: boolean;
		onResponseChange: (label: string, value: string) => void;
	} = $props();

	const hasContext = $derived(Boolean(question.context?.trim()));

	function getScoreColor(score: number): string {
		if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
		if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
		return 'text-red-600 dark:text-red-400';
	}

	function getScoreBg(score: number): string {
		if (score >= 80) return 'border-emerald-500/60 bg-emerald-500/10';
		if (score >= 60) return 'border-yellow-500/60 bg-yellow-500/10';
		return 'border-red-500/60 bg-red-500/10';
	}
</script>

{#if hasContext && !isMobileViewport}
	<div
		class={cn(
			'overflow-hidden rounded-lg border border-border/70',
			expanded ? 'min-h-0 flex-1' : 'h-80'
		)}
	>
		<Resizable.PaneGroup direction="horizontal" class="h-full">
			<Resizable.Pane defaultSize={48} minSize={28} class="min-w-0">
				<div class="h-full overflow-y-auto p-4 sm:p-5">
					<p class="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
						Stimulus
					</p>
					<div class="space-y-3 text-sm leading-6 text-foreground/90">
						<RichText text={question.context ?? ''} />
					</div>
				</div>
			</Resizable.Pane>
			<Resizable.Handle withHandle />
			<Resizable.Pane defaultSize={52} minSize={30} class="min-w-0">
				<div class="h-full space-y-5 overflow-y-auto p-4 sm:p-5">
					<div>
						<p class="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
							Prompt
						</p>
						<RichText text={question.prompt} class="text-sm leading-6 text-foreground/90" />
					</div>
					<div class="space-y-4">
						{#each question.parts as part (part.label)}
							{@const response = responses[part.label] ?? ''}
							<div class="space-y-1.5">
								<div class="flex items-start gap-2">
									<span
										class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-muted/50 text-xs font-semibold text-foreground"
									>
										{part.label}
									</span>
									<div class="flex min-w-0 flex-1 items-start justify-between gap-2">
										<RichText text={part.question} class="text-sm leading-6 text-foreground/90" />
										<span class="shrink-0 text-xs whitespace-nowrap text-muted-foreground">
											{part.pointValue} pt{part.pointValue !== 1 ? 's' : ''}
										</span>
									</div>
								</div>
								<Textarea
									disabled={hasSubmitted}
									value={response}
									oninput={(e) => {
										onResponseChange(part.label, (e.currentTarget as HTMLTextAreaElement).value);
									}}
									placeholder="Write your response here..."
									class="min-h-24 resize-y text-sm"
								/>
							</div>
						{/each}
					</div>
				</div>
			</Resizable.Pane>
		</Resizable.PaneGroup>
	</div>
{:else}
	<div class="space-y-2 rounded-lg border border-border/70 bg-muted/10 p-4 sm:p-5">
		<p class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Prompt</p>
		<RichText text={question.prompt} class="text-sm leading-6 text-foreground/90" />
	</div>
	<div class={cn('space-y-5', expanded && 'min-h-0 flex-1 overflow-y-auto pr-1')}>
		{#each question.parts as part (part.label)}
			{@const response = responses[part.label] ?? ''}
			<div class="space-y-2">
				<div class="flex items-start gap-2">
					<span
						class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-muted/50 text-xs font-semibold text-foreground"
					>
						{part.label}
					</span>
					<div class="flex min-w-0 flex-1 items-start justify-between gap-2">
						<RichText text={part.question} class="text-sm leading-6 text-foreground/90" />
						<span class="shrink-0 text-xs whitespace-nowrap text-muted-foreground">
							{part.pointValue} pt{part.pointValue !== 1 ? 's' : ''}
						</span>
					</div>
				</div>
				<Textarea
					disabled={hasSubmitted}
					value={response}
					oninput={(e) => {
						onResponseChange(part.label, (e.currentTarget as HTMLTextAreaElement).value);
					}}
					placeholder="Write your response here..."
					class="min-h-28 resize-y text-sm"
				/>
			</div>
		{/each}
	</div>
{/if}

{#if grade}
	<div class="space-y-4 rounded-lg border border-border/70 bg-muted/20 p-4 sm:p-5">
		<div class="flex flex-wrap items-center gap-3">
			<span class={cn('text-2xl font-bold tabular-nums', getScoreColor(grade.totalScore))}>
				{grade.totalScore}/100
			</span>
			<span class="text-sm text-muted-foreground">&mdash;</span>
			<span class="text-sm text-foreground/80">{grade.overallFeedback}</span>
		</div>
		<div class="space-y-3">
			{#each grade.parts as partGrade (partGrade.label)}
				<div class={cn('rounded-md border p-3 text-sm', getScoreBg(partGrade.score))}>
					<div class="flex items-center gap-2 font-medium">
						<span
							class="flex size-5 shrink-0 items-center justify-center rounded-full bg-background/60 text-xs"
						>
							{partGrade.label}
						</span>
						<span>{partGrade.pointsEarned}/{partGrade.pointsAvailable} pts</span>
					</div>
					<p class="mt-1.5 text-xs leading-5 text-foreground/80">{partGrade.feedback}</p>
				</div>
			{/each}
		</div>
	</div>
{/if}
