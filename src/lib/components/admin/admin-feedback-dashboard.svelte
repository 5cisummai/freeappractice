<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import type { AdminFeedbackItem } from '$lib/admin/types.js';
	import { APP_FEEDBACK_CATEGORY_LABELS } from '$lib/schemas/app-feedback.js';

	let {
		items = [],
		total = 0,
		totalSidebar = 0,
		totalBugReports = 0,
		errorMessage = null
	}: {
		items?: AdminFeedbackItem[];
		total?: number;
		totalSidebar?: number;
		totalBugReports?: number;
		errorMessage?: string | null;
	} = $props();

	function formatDateTime(value: Date | string | null | undefined): string {
		if (!value) return '—';
		return new Date(value).toLocaleString();
	}

	function sourceLabel(item: AdminFeedbackItem): string {
		if (item.source === 'bug_report') return 'Bug report';
		return APP_FEEDBACK_CATEGORY_LABELS[item.category ?? 'other'];
	}

	function reporterLabel(item: AdminFeedbackItem): string {
		if (item.userEmail) {
			return item.userName ? `${item.userName} · ${item.userEmail}` : item.userEmail;
		}
		if (item.reporterEmail) return item.reporterEmail;
		return 'Anonymous';
	}

	function questionContext(item: AdminFeedbackItem): string | null {
		if (item.source !== 'bug_report' || !item.metadata) return null;
		const questionNumber = item.metadata.questionNumber;
		const selectedClass = item.metadata.selectedClass;
		const selectedUnit = item.metadata.selectedUnit;
		if (typeof questionNumber !== 'string' && typeof questionNumber !== 'number') return null;

		const parts = [`Question ${questionNumber}`];
		if (typeof selectedClass === 'string' && selectedClass) parts.push(selectedClass);
		if (typeof selectedUnit === 'string' && selectedUnit) parts.push(selectedUnit);
		return parts.join(' · ');
	}
</script>

<div class="space-y-4">
	{#if errorMessage}
		<p
			class="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
		>
			{errorMessage}
		</p>
	{/if}

	<p class="text-sm text-muted-foreground">
		Sidebar feedback and bug reports. {total} submission{total === 1 ? '' : 's'} total ({totalSidebar}
		sidebar, {totalBugReports} bug reports).
	</p>

	<Card.Root>
		<Card.Content class="p-0">
			{#if items.length === 0}
				<p class="p-6 text-sm text-muted-foreground">No feedback yet.</p>
			{:else}
				<div class="divide-y divide-border">
					{#each items as item (`${item.source}-${item.id}`)}
						<div class="space-y-2 p-4">
							<div class="flex flex-wrap items-center justify-between gap-2">
								<div class="flex flex-wrap items-center gap-2">
									<Badge variant={item.source === 'bug_report' ? 'outline' : 'secondary'}>
										{sourceLabel(item)}
									</Badge>
									{#if item.source === 'bug_report' && item.severity}
										<Badge
											variant={item.severity === 'high'
												? 'destructive'
												: item.severity === 'medium'
													? 'default'
													: 'secondary'}
										>
											{item.severity}
										</Badge>
									{/if}
									<span class="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</span>
								</div>
								<p class="text-sm text-muted-foreground">{reporterLabel(item)}</p>
							</div>

							{#if item.source === 'sidebar'}
								<p class="text-sm whitespace-pre-wrap break-words">{item.message}</p>
							{:else}
								<p class="font-medium">{item.title}</p>
								{#if questionContext(item)}
									<p class="text-xs text-muted-foreground">{questionContext(item)}</p>
								{/if}
								<p class="text-sm whitespace-pre-wrap break-words">{item.description}</p>
								{#if item.steps}
									<div class="rounded-md border border-border/70 bg-muted/30 p-3 text-sm">
										<p class="font-medium text-muted-foreground">Steps to reproduce</p>
										<p class="mt-1 whitespace-pre-wrap break-words">{item.steps}</p>
									</div>
								{/if}
								{#if item.expected}
									<div class="rounded-md border border-border/70 bg-muted/30 p-3 text-sm">
										<p class="font-medium text-muted-foreground">Expected result</p>
										<p class="mt-1 whitespace-pre-wrap break-words">{item.expected}</p>
									</div>
								{/if}
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
