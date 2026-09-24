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

<div class="mb-5 w-full rounded-xl border border-border/70 bg-muted/20 p-5 sm:p-6">
	<div>
		<p class="text-2xl font-semibold tabular-nums">
			{grade.pointsEarned}/{grade.pointsAvailable}
		</p>
		<p class="text-sm text-muted-foreground">{grade.overallFeedback}</p>
		{#if onReportDisagreement}
			<div class="flex justify-start">
				<Button
					variant="ghost"
					size="sm"
					class="px-0 text-muted-foreground"
					onclick={onReportDisagreement}
					disabled={disagreementReported}
				>
					{disagreementReported ? 'Score feedback recorded' : 'This score seems off'}
				</Button>
			</div>
		{/if}
	</div>
</div>
