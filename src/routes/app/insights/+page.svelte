<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import PageShell from '$lib/components/layout/page-shell.svelte';
	import { apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/api.js';
	import { toast } from 'svelte-sonner';

	type InsightFeedback = 'helpful' | 'not_helpful';

	let { data } = $props();
	let refreshing = $state(false);
	let planning = $state(false);
	let feedbackSaving = $state(false);
	let submittedFeedback = $state<InsightFeedback | null>(null);
	let feedbackReason = $state('');
	let undoingAuditId = $state<string | null>(null);

	function getClaimPracticeHref(claim: unknown): string | undefined {
		if (!claim || typeof claim !== 'object') return undefined;
		const practiceHref = (claim as { practiceHref?: unknown }).practiceHref;
		return typeof practiceHref === 'string' && practiceHref.trim() ? practiceHref : undefined;
	}

	async function refreshInsights() {
		if (refreshing) return;
		refreshing = true;
		try {
			const response = await apiFetch('/api/insights', {
				method: 'POST',
				headers: { 'Idempotency-Key': crypto.randomUUID() }
			});
			const result = await readJsonOrNull<{ error?: string }>(response);
			if (!response.ok) throw new Error(getResponseMessage(result, 'Could not refresh insights.'));
			toast.success('Insights refreshed.');
			await goto(resolve('/app/insights'), { invalidateAll: true });
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not refresh insights.');
		} finally {
			refreshing = false;
		}
	}

	async function submitFeedback(feedback: InsightFeedback) {
		const report = data.report;
		if (!report || feedbackSaving) return;
		feedbackSaving = true;
		try {
			const response = await apiFetch('/api/insights/feedback', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					reportId: report.id,
					feedback,
					...(feedbackReason ? { reason: feedbackReason } : {})
				})
			});
			const result = await readJsonOrNull<{ error?: string }>(response);
			if (!response.ok)
				throw new Error(getResponseMessage(result, 'Could not save your insight feedback.'));
			submittedFeedback = feedback;
			toast.success('Thanks for the feedback.');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not save your insight feedback.');
		} finally {
			feedbackSaving = false;
		}
	}

	async function applyProposal(behavior: 'merge' | 'replace') {
		if (planning) return;
		planning = true;
		try {
			const response = await apiFetch('/api/study-plan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
				body: JSON.stringify({ action: 'generate', behavior })
			});
			const result = await readJsonOrNull<{ error?: string }>(response);
			if (!response.ok)
				throw new Error(getResponseMessage(result, 'Could not apply the proposed study plan.'));
			toast.success(
				behavior === 'merge' ? 'Proposal merged into your study plan.' : 'Active plan replaced.'
			);
			await goto(resolve('/app/insights'), { invalidateAll: true });
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : 'Could not apply the proposed study plan.'
			);
		} finally {
			planning = false;
		}
	}

	async function completeTask(taskId: string) {
		const response = await apiFetch('/api/study-plan', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
			body: JSON.stringify({ action: 'complete', taskId })
		});
		if (!response.ok) {
			toast.error('Could not complete that task.');
			return;
		}
		await goto(resolve('/app/insights'), { invalidateAll: true });
	}

	async function undoPlanChange(auditId: string) {
		if (undoingAuditId) return;
		undoingAuditId = auditId;
		try {
			const response = await apiFetch('/api/study-plan/undo', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
				body: JSON.stringify({ auditId })
			});
			const result = await readJsonOrNull<{ error?: string }>(response);
			if (!response.ok)
				throw new Error(getResponseMessage(result, 'Could not undo that plan change.'));
			toast.success('Study-plan change undone.');
			await goto(resolve('/app/insights'), { invalidateAll: true });
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not undo that plan change.');
		} finally {
			undoingAuditId = null;
		}
	}
</script>

<svelte:head><title>Insights – Free AP Practice</title></svelte:head>

<PageShell
	title="Insights"
	description="Evidence-based patterns from scored practice — not an AP score prediction."
>
	{#if !data.entitlements.aiInsights}
		<Card.Root class="mx-auto max-w-2xl"
			><Card.Content class="space-y-3 p-6"
				><h2 class="font-display text-2xl">Super feature</h2>
				<p class="text-sm text-muted-foreground">
					Unlock personal insights and one active weekly study plan with Super.
				</p>
				<Button href="/pricing">See Super</Button></Card.Content
			></Card.Root
		>
	{:else if !data.insightsEnabled}
		<Card.Root class="mx-auto max-w-2xl"
			><Card.Content class="p-6 text-sm text-muted-foreground"
				>Insights are temporarily unavailable. Existing study progress remains safe.</Card.Content
			></Card.Root
		>
	{:else if !data.profile.ageConfirmedAt}
		<Card.Root class="mx-auto max-w-2xl"
			><Card.Content class="space-y-3 p-6"
				><h2 class="font-display text-2xl">Confirm your age</h2>
				<p class="text-sm text-muted-foreground">
					Insights use personalized study information and are available to students aged 13 or
					older.
				</p>
				<Button href="/app/confirm-age">Confirm age</Button></Card.Content
			></Card.Root
		>
	{:else}
		<div class="mx-auto grid max-w-4xl gap-5">
			<Card.Root
				><Card.Content class="flex flex-wrap items-center justify-between gap-4 p-5"
					><div>
						<p class="font-medium">Evidence requirement</p>
						<p class="mt-1 text-sm text-muted-foreground">
							{data.eligibility?.totalScoredAttempts ?? 0}/20 total scored attempts · {data
								.eligibility?.eligibleClaimCount ?? 0} course/unit evidence groups with at least 5 attempts.
							MCQ and FRQ are calculated separately.
						</p>
					</div>
					<Button onclick={refreshInsights} disabled={refreshing || !data.eligibility?.eligible}
						>{refreshing ? 'Refreshing…' : 'Refresh insights'}</Button
					></Card.Content
				></Card.Root
			>
			{#if data.report}
				{#if data.report.report.narrative}<Card.Root
						><Card.Content class="p-5 text-sm leading-6"
							>{data.report.report.narrative}</Card.Content
						></Card.Root
					>{/if}
				<Card.Root>
					<Card.Content class="flex flex-wrap items-center justify-between gap-4 p-5">
						<div>
							<p class="font-medium">Was this insight report helpful?</p>
							<p class="mt-1 text-sm text-muted-foreground">
								Your feedback helps us improve the study guidance.
							</p>
						</div>
						<div class="flex gap-2">
							<Button
								variant={(submittedFeedback ?? data.report.feedback) === 'helpful'
									? 'default'
									: 'outline'}
								disabled={feedbackSaving}
								onclick={() => submitFeedback('helpful')}>Helpful</Button
							>
							<Button
								variant={(submittedFeedback ?? data.report.feedback) === 'not_helpful'
									? 'default'
									: 'outline'}
								disabled={feedbackSaving}
								onclick={() => submitFeedback('not_helpful')}>Not helpful</Button
							>
						</div>
						<label class="w-full text-sm text-muted-foreground">
							<span class="sr-only">Optional feedback reason</span>
							<select
								bind:value={feedbackReason}
								class="w-full rounded-md border border-input bg-background px-3 py-2"
							>
								<option value="">Optional: tell us more</option>
								<option value="not_actionable">Not actionable</option>
								<option value="not_accurate">Evidence did not feel accurate</option>
								<option value="too_generic">Too generic</option>
								<option value="other">Other</option>
							</select>
						</label>
					</Card.Content>
				</Card.Root>
				<div class="grid gap-5 md:grid-cols-2">
					<Card.Root
						><Card.Header><Card.Title>Strengths</Card.Title></Card.Header><Card.Content
							class="space-y-3"
							>{#each data.report.report.strengths.slice(0, 5) as claim (`${claim.source}-${claim.apClass}-${claim.unit}`)}<div
									class="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted p-3 text-sm"
								>
									<div>
										<p class="font-medium">{claim.apClass} · {claim.unit}</p>
										<p class="text-muted-foreground">
											{Math.round(claim.metric.weightedAveragePercentage)}% weighted · {claim.metric
												.count} scored {claim.source.toUpperCase()} attempts
										</p>
									</div>
									{#if getClaimPracticeHref(claim)}<Button
											href={getClaimPracticeHref(claim)}
											size="sm"
											variant="outline">Practice</Button
										>{/if}
								</div>{:else}<p class="text-sm text-muted-foreground">
									More evidence will reveal strengths.
								</p>{/each}</Card.Content
						></Card.Root
					><Card.Root
						><Card.Header><Card.Title>Focus next</Card.Title></Card.Header><Card.Content
							class="space-y-3"
							>{#each data.report.report.weaknesses.slice(0, 5) as claim (`${claim.source}-${claim.apClass}-${claim.unit}`)}<div
									class="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted p-3 text-sm"
								>
									<div>
										<p class="font-medium">{claim.apClass} · {claim.unit}</p>
										<p class="text-muted-foreground">
											{Math.round(claim.metric.weightedAveragePercentage)}% weighted · {claim.metric
												.count} scored {claim.source.toUpperCase()} attempts
										</p>
									</div>
									{#if getClaimPracticeHref(claim)}<Button
											href={getClaimPracticeHref(claim)}
											size="sm"
											variant="outline">Practice</Button
										>{/if}
								</div>{:else}<p class="text-sm text-muted-foreground">
									No eligible focus area yet.
								</p>{/each}</Card.Content
						></Card.Root
					>
				</div>
				{#if data.proposal?.tasks.length}
					<Card.Root>
						<Card.Header>
							<Card.Title>Proposed seven-day plan</Card.Title>
							<Card.Description>
								These tasks are based on your insight report and are not saved until you choose how
								to apply this proposal.
							</Card.Description>
						</Card.Header>
						<Card.Content class="space-y-3">
							{#each data.proposal.tasks as task, index (task.id)}
								<div
									class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3"
								>
									<div>
										<p class="text-sm font-medium">
											Day {index + 1} · {task.apClass} · {task.unit}
										</p>
										<p class="text-xs text-muted-foreground">
											{new Date(task.date).toLocaleDateString()} · {task.durationMinutes} min · {task.mode.toUpperCase()}
										</p>
									</div>
									{#if task.practiceHref}<Button
											href={task.practiceHref}
											size="sm"
											variant="outline">Practice</Button
										>{/if}
								</div>
							{/each}
							<div class="space-y-2 border-t border-border pt-3">
								<p class="text-sm font-medium">
									{data.plan
										? 'Choose how to apply this proposal to your active plan.'
										: 'Ready to start this proposed plan?'}
								</p>
								<div class="flex flex-wrap gap-2">
									{#if data.plan}
										<Button
											variant="outline"
											onclick={() => applyProposal('merge')}
											disabled={planning}>{planning ? 'Applying…' : 'Merge proposal'}</Button
										>
										<Button onclick={() => applyProposal('replace')} disabled={planning}
											>{planning ? 'Applying…' : 'Replace active plan'}</Button
										>
									{:else}
										<Button onclick={() => applyProposal('replace')} disabled={planning}
											>{planning ? 'Applying…' : 'Apply proposed plan'}</Button
										>
									{/if}
								</div>
							</div>
						</Card.Content>
					</Card.Root>
				{/if}
				<Card.Root
					><Card.Header
						><Card.Title>Active weekly study plan</Card.Title><Card.Description
							>One active plan. Every task is capped at 30 minutes.</Card.Description
						></Card.Header
					><Card.Content class="space-y-3"
						>{#if data.plan}{#each data.plan.tasks as task (task.id)}<div
									class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3"
								>
									<div>
										<p class:line-through={task.status === 'done'} class="text-sm font-medium">
											{task.apClass} · {task.unit}
										</p>
										<p class="text-xs text-muted-foreground">
											{new Date(task.date).toLocaleDateString()} · {task.durationMinutes} min · {task.mode.toUpperCase()}
										</p>
									</div>
									<div class="flex gap-2">
										{#if task.practiceHref}<Button
												href={task.practiceHref}
												size="sm"
												variant="outline">Practice</Button
											>{/if}<Button
											size="sm"
											disabled={task.status === 'done'}
											onclick={() => completeTask(task.id)}
											>{task.status === 'done' ? 'Done' : 'Complete'}</Button
										>
									</div>
								</div>{/each}{:else}<p class="text-sm text-muted-foreground">
								{data.proposal?.tasks.length
									? 'Choose “Apply proposed plan” above to create your first active plan.'
									: 'An active plan will appear here after an eligible insight report is available.'}
							</p>{/if}</Card.Content
					></Card.Root
				>
				{#if data.planAudits.length}
					<Card.Root>
						<Card.Header
							><Card.Title>Recent plan changes</Card.Title><Card.Description
								>Plan changes are retained for 90 days and can be undone while no later plan change
								conflicts.</Card.Description
							></Card.Header
						>
						<Card.Content class="space-y-2">
							{#each data.planAudits as audit (audit.id)}
								<div
									class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
								>
									<p class="text-sm">
										{audit.action === 'generate'
											? 'Created or updated the weekly plan'
											: audit.action === 'complete'
												? 'Completed a study task'
												: 'Rescheduled a study task'} · {new Date(audit.createdAt).toLocaleString()}
									</p>
									{#if audit.undoneAt}<span class="text-sm text-muted-foreground">Undone</span
										>{:else}<Button
											variant="outline"
											size="sm"
											disabled={undoingAuditId === audit.id}
											onclick={() => undoPlanChange(audit.id)}
											>{undoingAuditId === audit.id ? 'Undoing…' : 'Undo'}</Button
										>{/if}
								</div>
							{/each}
						</Card.Content>
					</Card.Root>
				{/if}
			{:else}<Card.Root
					><Card.Content class="p-6 text-sm text-muted-foreground"
						>Once you have the required evidence, refresh to create your first insight report.</Card.Content
					></Card.Root
				>{/if}
		</div>
	{/if}
</PageShell>
