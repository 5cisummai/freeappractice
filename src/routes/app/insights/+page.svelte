<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import CheckIcon from '@lucide/svelte/icons/check';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import Undo2Icon from '@lucide/svelte/icons/undo-2';
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

	const pdfUrl = resolve('/api/insights/pdf');
	const evidenceProgress = $derived(
		Math.min(
			100,
			((data.eligibility?.totalScoredAttempts ?? 0) /
				(data.eligibility?.minimumTotalAttempts || 20)) *
				100
		)
	);

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
			toast.success('AI report refreshed.');
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

<svelte:head>
	<title>Insights - Free AP Practice</title>
</svelte:head>

<PageShell
	title="Insights"
	description="An AI-authored PDF report built from your practice evidence"
>
	{#snippet actions()}
		{#if data.entitlements.aiInsights && data.insightsEnabled && data.profile.ageConfirmedAt}
			<Button
				variant="outline"
				disabled={refreshing || !data.eligibility?.eligible}
				onclick={refreshInsights}
			>
				<RefreshCwIcon class={refreshing ? 'animate-spin' : ''} size={15} />
				{refreshing ? 'Refreshing...' : 'Refresh report'}
			</Button>
		{/if}
	{/snippet}

	{#if !data.entitlements.aiInsights}
		<Card.Root class="mx-auto max-w-2xl">
			<Card.Content class="space-y-3 p-6">
				<h2 class="font-display text-2xl">Super feature</h2>
				<p class="text-sm text-muted-foreground">
					Unlock personal insights and one active weekly study plan with Super.
				</p>
				<Button href="/pricing">See Super</Button>
			</Card.Content>
		</Card.Root>
	{:else if !data.insightsEnabled}
		<Card.Root class="mx-auto max-w-2xl">
			<Card.Content class="p-6 text-sm text-muted-foreground">
				Insights are temporarily unavailable. Existing study progress remains safe.
			</Card.Content>
		</Card.Root>
	{:else if !data.profile.ageConfirmedAt}
		<Card.Root class="mx-auto max-w-2xl">
			<Card.Content class="space-y-3 p-6">
				<h2 class="font-display text-2xl">Confirm your age</h2>
				<p class="text-sm text-muted-foreground">
					Insights use personalized study information and are available to students aged 13 or
					older.
				</p>
				<Button href="/app/confirm-age">Confirm age</Button>
			</Card.Content>
		</Card.Root>
	{:else if !data.report}
		<section class="report-empty" aria-labelledby="empty-report-title">
			<div class="report-empty-icon"><FileTextIcon size={22} /></div>
			<p class="report-eyebrow">AI report</p>
			<h2 id="empty-report-title" class="font-display">Your first report is almost ready.</h2>
			<p>
				Complete the evidence threshold below, then refresh to have the AI turn your practice
				history into a PDF report.
			</p>
			<div class="evidence-card">
				<div class="evidence-count">
					<strong>{data.eligibility?.totalScoredAttempts ?? 0}</strong>
					<span>/ {data.eligibility?.minimumTotalAttempts ?? 20} scored attempts</span>
				</div>
				<div class="evidence-meter" aria-hidden="true">
					<span style={`width: ${evidenceProgress}%`}></span>
				</div>
				<p>
					{data.eligibility?.eligibleClaimCount ?? 0} course/unit evidence groups have at least
					{data.eligibility?.minimumAttemptsPerClaim ?? 5} attempts. MCQ and FRQ are calculated separately.
				</p>
			</div>
		</section>
	{:else}
		<section class="pdf-shell" aria-labelledby="pdf-report-title">
			<header class="pdf-toolbar">
				<div class="pdf-toolbar-title">
					<div class="pdf-icon"><FileTextIcon size={19} /></div>
					<div>
						<p class="report-eyebrow">AI-generated document</p>
						<h2 id="pdf-report-title">Personal assessment brief</h2>
					</div>
				</div>
				<div class="pdf-toolbar-actions">
					<Button href={pdfUrl} target="_blank" rel="noreferrer" variant="outline" size="sm">
						<ExternalLinkIcon size={14} /> Open PDF
					</Button>
					<Button href={pdfUrl} download size="sm">
						<DownloadIcon size={14} /> Download
					</Button>
				</div>
			</header>
			<div class="pdf-frame-wrap">
				<iframe title="AI-generated Insights PDF" src={pdfUrl} class="pdf-frame"></iframe>
			</div>
			<p class="pdf-caption">
				Generated {new Date(data.report.generatedAt).toLocaleDateString()} from {data.report
					.evidenceAttemptCount}
				scored attempts. Refreshing creates a new AI-authored PDF after 10 additional attempts.
			</p>
		</section>

		<section class="support-grid" aria-label="Study plan and report feedback">
			{#if data.proposal?.tasks.length}
				<Card.Root class="support-card">
					<Card.Header>
						<Card.Title>Proposed seven-day plan</Card.Title>
						<Card.Description>
							The PDF explains the priorities; these controls apply them to your active plan.
						</Card.Description>
					</Card.Header>
					<Card.Content class="space-y-3">
						{#each data.proposal.tasks as task, index (task.id)}
							<div class="plan-row">
								<div>
									<p class="font-medium">Day {index + 1} · {task.apClass} · {task.unit}</p>
									<p class="text-xs text-muted-foreground">
										{new Date(task.date).toLocaleDateString()} · {task.durationMinutes} min · {task.mode.toUpperCase()}
									</p>
								</div>
								{#if task.practiceHref}<Button href={task.practiceHref} size="sm" variant="outline"
										><BookOpenIcon size={13} /> Practice</Button
									>{/if}
							</div>
						{/each}
						<div class="plan-actions">
							<p class="text-sm font-medium">
								{data.plan
									? 'Choose how to apply this proposal.'
									: 'Ready to start this proposed plan?'}
							</p>
							<div class="flex flex-wrap gap-2">
								{#if data.plan}<Button
										variant="outline"
										onclick={() => applyProposal('merge')}
										disabled={planning}>{planning ? 'Applying...' : 'Merge proposal'}</Button
									><Button onclick={() => applyProposal('replace')} disabled={planning}
										>{planning ? 'Applying...' : 'Replace active plan'}</Button
									>{:else}<Button onclick={() => applyProposal('replace')} disabled={planning}
										>{planning ? 'Applying...' : 'Apply proposed plan'}</Button
									>{/if}
							</div>
						</div>
					</Card.Content>
				</Card.Root>
			{/if}

			<Card.Root class="support-card">
				<Card.Header>
					<Card.Title>Active weekly study plan</Card.Title>
					<Card.Description>One active plan. Every task is capped at 30 minutes.</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-3">
					{#if data.plan}
						{#each data.plan.tasks as task (task.id)}
							<div class="plan-row" class:plan-row-done={task.status === 'done'}>
								<div>
									<p class="font-medium" class:line-through={task.status === 'done'}>
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
											variant="outline"><BookOpenIcon size={13} /> Practice</Button
										>{/if}<Button
										size="sm"
										disabled={task.status === 'done'}
										onclick={() => completeTask(task.id)}
										><CheckIcon size={13} />{task.status === 'done' ? 'Done' : 'Complete'}</Button
									>
								</div>
							</div>
						{/each}
					{:else}<p class="text-sm text-muted-foreground">
							An active plan will appear after you apply a proposal.
						</p>{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root class="support-card feedback-card">
				<Card.Header>
					<Card.Title>Report feedback</Card.Title>
					<Card.Description>Was the AI-generated report useful?</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-3">
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
					<label>
						<span class="sr-only">Optional feedback reason</span>
						<select bind:value={feedbackReason}>
							<option value="">Optional: tell us more</option>
							<option value="not_actionable">Not actionable</option>
							<option value="not_accurate">Evidence did not feel accurate</option>
							<option value="too_generic">Too generic</option>
							<option value="other">Other</option>
						</select>
					</label>
				</Card.Content>
			</Card.Root>
		</section>

		{#if data.planAudits.length}
			<Card.Root class="audit-card">
				<Card.Header>
					<Card.Title>Recent plan changes</Card.Title>
					<Card.Description
						>Plan changes are retained for 90 days and can be undone.</Card.Description
					>
				</Card.Header>
				<Card.Content class="space-y-2">
					{#each data.planAudits as audit (audit.id)}
						<div class="audit-row">
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
									><Undo2Icon size={13} />{undoingAuditId === audit.id
										? 'Undoing...'
										: 'Undo'}</Button
								>{/if}
						</div>
					{/each}
				</Card.Content>
			</Card.Root>
		{/if}
	{/if}
</PageShell>

<style>
	.report-empty,
	.pdf-shell,
	:global(.audit-card),
	:global(.support-card) {
		border: 1px solid var(--border);
		border-radius: 1rem;
		background: var(--card);
		box-shadow: 0 12px 30px color-mix(in oklab, var(--foreground) 6%, transparent);
	}

	.report-empty {
		max-width: 52rem;
		margin: 0 auto;
		padding: clamp(2rem, 6vw, 4rem);
		text-align: center;
	}

	.report-empty-icon,
	.pdf-icon {
		display: grid;
		place-items: center;
		width: 2.75rem;
		height: 2.75rem;
		border-radius: 0.75rem;
		background: color-mix(in oklab, var(--primary) 12%, transparent);
		color: var(--primary);
	}

	.report-empty-icon {
		margin: 0 auto 1.25rem;
	}

	.report-eyebrow {
		margin: 0 0 0.35rem;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--primary);
	}

	.report-empty h2 {
		margin: 0;
		font-size: clamp(2rem, 5vw, 3.5rem);
		font-weight: 500;
		letter-spacing: -0.05em;
	}

	.report-empty > p:not(.report-eyebrow) {
		max-width: 36rem;
		margin: 1rem auto 0;
		font-size: 0.95rem;
		line-height: 1.7;
		color: var(--muted-foreground);
	}

	.evidence-card {
		margin-top: 2rem;
		border-top: 1px solid var(--border);
		padding-top: 1.25rem;
		text-align: left;
	}

	.evidence-count {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	.evidence-count strong {
		font-family: var(--font-display);
		font-size: 3rem;
		font-weight: 500;
		letter-spacing: -0.06em;
		line-height: 1;
	}

	.evidence-count span,
	.evidence-card > p,
	.pdf-caption {
		font-size: 0.8rem;
		color: var(--muted-foreground);
	}

	.evidence-meter {
		height: 0.5rem;
		margin-top: 0.75rem;
		overflow: hidden;
		border-radius: 999px;
		background: var(--muted);
	}

	.evidence-meter span {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--primary);
		transition: width 300ms ease;
	}

	.evidence-card > p {
		margin: 0.75rem 0 0;
		line-height: 1.55;
	}

	.pdf-shell {
		overflow: hidden;
	}

	.pdf-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid var(--border);
	}

	.pdf-toolbar-title,
	.pdf-toolbar-actions,
	.plan-row,
	.audit-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.pdf-toolbar-title {
		min-width: 0;
	}

	.pdf-toolbar-title h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.25rem;
		font-weight: 500;
		letter-spacing: -0.02em;
	}

	.pdf-toolbar-title .report-eyebrow {
		margin-bottom: 0.15rem;
		font-size: 0.6rem;
	}

	.pdf-frame-wrap {
		background: color-mix(in oklab, var(--muted) 42%, var(--background));
		padding: clamp(0.75rem, 2vw, 1.5rem);
	}

	.pdf-frame {
		display: block;
		width: 100%;
		height: min(78vh, 980px);
		min-height: 620px;
		border: 0;
		border-radius: 0.4rem;
		background: white;
		box-shadow: 0 10px 24px color-mix(in oklab, var(--foreground) 12%, transparent);
	}

	.pdf-caption {
		margin: 0;
		padding: 0.8rem 1.25rem 1rem;
	}

	.support-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1.25rem;
	}

	:global(.support-card),
	:global(.audit-card) {
		box-shadow: none;
	}

	:global(.feedback-card) {
		grid-column: span 2;
	}

	.plan-row,
	.audit-row {
		justify-content: space-between;
		align-items: flex-start;
		padding: 0.75rem 0;
		border-bottom: 1px solid var(--border);
	}

	.plan-row:last-child,
	.audit-row:last-child {
		border-bottom: 0;
	}

	.plan-row > div:first-child,
	.audit-row > p {
		min-width: 0;
		margin: 0;
	}

	.plan-actions {
		border-top: 1px solid var(--border);
		padding-top: 1rem;
	}

	.plan-actions p {
		margin: 0 0 0.75rem;
	}

	:global(.feedback-card) select {
		width: 100%;
		border: 1px solid var(--input);
		border-radius: 0.4rem;
		background: var(--background);
		padding: 0.55rem 0.7rem;
		font-size: 0.8rem;
		color: var(--foreground);
	}

	@media (max-width: 720px) {
		.pdf-toolbar {
			align-items: flex-start;
			flex-direction: column;
		}

		.pdf-toolbar-actions {
			width: 100%;
		}

		.pdf-toolbar-actions :global([data-slot='button']) {
			flex: 1;
		}

		.support-grid {
			grid-template-columns: 1fr;
		}

		:global(.feedback-card) {
			grid-column: auto;
		}
	}

	@media (max-width: 560px) {
		.pdf-frame {
			height: 72vh;
			min-height: 520px;
		}

		.plan-row,
		.audit-row {
			flex-wrap: wrap;
		}

		.plan-row > div:last-child,
		.audit-row > :global([data-slot='button']) {
			margin-left: auto;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.evidence-meter span {
			transition: none;
		}
	}
</style>
