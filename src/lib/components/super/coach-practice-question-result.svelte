<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import type { CoachPracticeQuestionToolOutput } from '$lib/super/coach-practice-question';

	let { result }: { result: CoachPracticeQuestionToolOutput } = $props();

	const statusLabel = $derived(
		result.status === 'skipped'
			? 'Skipped'
			: result.mode === 'frq'
				? 'Submitted'
				: result.isCorrect
					? 'Correct'
					: 'Incorrect'
	);
</script>

<div class="mt-3 max-w-3xl rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
	<div class="flex flex-wrap items-center gap-2">
		<Badge variant="secondary">{statusLabel}</Badge>
		<span class="text-sm text-muted-foreground">{result.apClass} · {result.unit}</span>
	</div>
	<p class="mt-2 text-sm leading-6 text-foreground/90">{result.prompt}</p>
	{#if result.status === 'answered' && result.mode === 'mcq' && result.selectedAnswer}
		<p class="mt-2 text-sm text-muted-foreground">
			Your answer: {result.selectedAnswer}
		</p>
	{/if}
	{#if result.status === 'answered' && result.mode === 'frq' && result.frqPointsEarned != null}
		<p class="mt-2 text-sm text-muted-foreground">
			Score: {result.frqPointsEarned}/{result.frqPointsAvailable}
		</p>
	{/if}
</div>
