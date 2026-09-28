<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import QuestionCard from '$lib/components/questions/question-card.svelte';
	import { toast } from 'svelte-sonner';
	import { unlimitedQuestionCardModel } from '$lib/question-bank/question-card-model.js';
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

	let markingBadQuestionId = $state<string | null>(null);
	let markedBadQuestionIds = $state<Record<string, true>>({});

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
		const selectedCourse = item.metadata.selectedCourse;
		const selectedUnit = item.metadata.selectedUnit;
		if (typeof questionNumber !== 'string' && typeof questionNumber !== 'number') return null;

		const parts = [`Question ${questionNumber}`];
		if (typeof selectedCourse === 'string' && selectedCourse) parts.push(selectedCourse);
		if (typeof selectedUnit === 'string' && selectedUnit) parts.push(selectedUnit);
		return parts.join(' · ');
	}

	function questionPreview(
		item: AdminFeedbackItem
	): { questionId: string; selectedCourse: string; selectedUnit: string } | null {
		if (item.source !== 'bug_report' || !item.metadata) return null;
		const questionId = item.metadata.questionId;
		if (typeof questionId !== 'string' || !questionId) return null;
		const selectedCourse =
			typeof item.metadata.selectedCourse === 'string' ? item.metadata.selectedCourse : '';
		const selectedUnit =
			typeof item.metadata.selectedUnit === 'string' ? item.metadata.selectedUnit : '';
		return { questionId, selectedCourse, selectedUnit };
	}

	async function markQuestionBad(
		item: AdminFeedbackItem,
		preview: { questionId: string; selectedCourse: string; selectedUnit: string }
	): Promise<void> {
		if (markingBadQuestionId) return;
		markingBadQuestionId = preview.questionId;
		const notes = `Marked bad from bug report: ${item.title ?? item.id} (report ${item.id})`;
		try {
			const response = await fetch('/api/admin/question-quality', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'humanDecision',
					questionId: preview.questionId,
					verdict: 'bad',
					notes
				})
			});
			if (!response.ok) {
				let message = 'Unable to mark question as bad.';
				try {
					const data = (await response.json()) as { message?: string };
					if (typeof data.message === 'string') message = data.message;
				} catch {
					// ignore parse errors
				}
				toast.error(message);
				return;
			}
			markedBadQuestionIds = { ...markedBadQuestionIds, [preview.questionId]: true };
			toast.success('Question marked bad.');
		} catch {
			toast.error('Unable to mark question as bad.');
		} finally {
			markingBadQuestionId = null;
		}
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
									<span class="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</span
									>
								</div>
								<p class="text-sm text-muted-foreground">{reporterLabel(item)}</p>
							</div>

							{#if item.source === 'sidebar'}
								<p class="text-sm break-words whitespace-pre-wrap">{item.message}</p>
							{:else}
								<p class="font-medium">{item.title}</p>
								{#if questionContext(item)}
									<p class="text-xs text-muted-foreground">{questionContext(item)}</p>
								{/if}
								<p class="text-sm break-words whitespace-pre-wrap">{item.description}</p>
								{#if item.steps}
									<div class="space-y-1 text-sm">
										<p class="font-medium text-muted-foreground">Steps to reproduce</p>
										<p class="break-words whitespace-pre-wrap">{item.steps}</p>
									</div>
								{/if}
								{#if item.expected}
									<div class="space-y-1 text-sm">
										<p class="font-medium text-muted-foreground">Expected result</p>
										<p class="break-words whitespace-pre-wrap">{item.expected}</p>
									</div>
								{/if}
								{@const preview = questionPreview(item)}
								{#if preview}
									<div class="flex justify-end">
										<Button
											size="sm"
											variant="outline"
											class="border-destructive/30 text-destructive hover:bg-destructive/10"
											onclick={() => void markQuestionBad(item, preview)}
											disabled={!!markedBadQuestionIds[preview.questionId] ||
												markingBadQuestionId === preview.questionId}
										>
											{markedBadQuestionIds[preview.questionId]
												? 'Marked bad'
												: markingBadQuestionId === preview.questionId
													? 'Marking…'
													: 'Mark bad'}
										</Button>
									</div>
									{#key preview.questionId}
										<QuestionCard
												model={unlimitedQuestionCardModel({
													selectedCourse: preview.selectedCourse,
													selectedUnit: preview.selectedUnit,
													requestVersion: 1,
													presetQuestionId: preview.questionId
												})}
												tutorMode="hidden"
												showUtilityActions={false}
												showFirstUseHint={false}
												nextDisabled={true}
												class="border-0 bg-transparent shadow-none ring-0"
										/>
									{/key}
								{/if}
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
