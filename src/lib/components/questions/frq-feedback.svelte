<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import type { FrqGrade } from '$lib/question-bank/frq/types';

	type Props = {
		grade: FrqGrade;
		disagreementReported?: boolean;
		onReportDisagreement?: () => void;
	};

	let { grade, disagreementReported = false, onReportDisagreement }: Props = $props();
</script>

<div class="mt-8 space-y-4 rounded-xl border border-border/70 bg-muted/20 p-5 sm:p-6">
	<div>
		<p class="text-2xl font-semibold tabular-nums">
			{grade.pointsEarned}/{grade.pointsAvailable}
		</p>
		<p class="text-sm text-muted-foreground">{grade.overallFeedback}</p>
		{#if onReportDisagreement}
			<Button
				variant="ghost"
				size="sm"
				class="mt-2 px-0 text-muted-foreground hover:text-foreground"
				onclick={onReportDisagreement}
				disabled={disagreementReported}
			>
				{disagreementReported ? 'Score feedback recorded' : 'This score seems off'}
			</Button>
		{/if}
	</div>
	<div class="space-y-3">
		{#each grade.parts as part (part.id)}
			<div class="rounded-xl border border-border/70 bg-background p-4">
				<div class="flex flex-wrap items-center justify-between gap-2">
					<p class="text-sm font-medium">{part.label}</p>
					<p class="text-sm font-semibold tabular-nums">
						{part.points}/{part.pointsAvailable}
					</p>
				</div>
				<p class="mt-1 text-sm leading-6 text-muted-foreground">{part.feedback}</p>
			</div>
		{/each}
	</div>
</div>
