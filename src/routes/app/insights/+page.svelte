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
	import { formatDateOnly } from '$lib/date-only.js';
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

<PageShell title="Insights" description="View a report of your practice for the last week">
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
		<section
			class="mx-auto max-w-[52rem] rounded-2xl border border-border bg-card p-[clamp(2rem,6vw,4rem)] text-center shadow-lg"
			aria-labelledby="empty-report-title"
		>
			<div
				class="mx-auto mb-5 grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"
			>
				<FileTextIcon size={22} />
			</div>
			<h2
				id="empty-report-title"
				class="m-0 font-display text-[clamp(2rem,5vw,3.5rem)] font-medium tracking-[-0.05em]"
			>
				Your first report is almost ready.
			</h2>
			<p class="mx-auto mt-4 max-w-xl text-[0.95rem] leading-[1.7] text-muted-foreground">
				Complete the evidence threshold below, then refresh to have the AI turn your practice
				history into a PDF report.
			</p>
			<div class="mt-8 border-t border-border pt-5 text-left">
				<div class="flex items-baseline gap-2">
					<strong class="font-display text-5xl leading-none font-medium tracking-[-0.06em]"
						>{data.eligibility?.totalScoredAttempts ?? 0}</strong
					>
					<span class="text-xs text-muted-foreground"
						>/ {data.eligibility?.minimumTotalAttempts ?? 20} scored attempts</span
					>
				</div>
				<div class="mt-3 h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
					<span
						class="block h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
						style={`width: ${evidenceProgress}%`}
					></span>
				</div>
				<p class="mt-3 mb-0 text-xs leading-[1.55] text-muted-foreground">
					{data.eligibility?.eligibleClaimCount ?? 0} subjects have enough practice for insights.
					Multiple-choice and written-response progress count separately.
				</p>
			</div>
		</section>
	{:else}
		<section class="relative overflow-hidden" aria-labelledby="pdf-report-title">
			<h2 id="pdf-report-title" class="sr-only">Personal assessment brief</h2>
			<div class="relative">
				<iframe
					title="AI-generated Insights PDF"
					src={pdfUrl}
					class="block h-[min(78vh,980px)] min-h-[620px] w-full border-0 bg-white max-[560px]:h-[72vh] max-[560px]:min-h-[520px]"
				></iframe>
				<div class="absolute top-4 right-4 z-10 flex gap-1.5 max-[560px]:top-2 max-[560px]:right-2">
					<Button
						href={pdfUrl}
						target="_blank"
						rel="noreferrer"
						variant="ghost"
						size="sm"
						class="bg-background/85 shadow-sm backdrop-blur-sm hover:bg-background"
					>
						<ExternalLinkIcon size={14} /> Open PDF
					</Button>
					<Button
						href={pdfUrl}
						download
						size="sm"
						variant="ghost"
						class="bg-background/85 shadow-sm backdrop-blur-sm hover:bg-background"
					>
						<DownloadIcon size={14} /> Download
					</Button>
				</div>
			</div>
			<p class="m-0 pt-3 text-xs text-muted-foreground">
				Generated {new Date(data.report.generatedAt).toLocaleDateString()} from {data.report
					.evidenceAttemptCount}
				scored attempts. Refreshing creates a new AI-authored PDF after 10 additional attempts.
			</p>
		</section>

		<section
			class="grid grid-cols-2 gap-5 max-[720px]:grid-cols-1"
			aria-label="Study plan and report feedback"
		>
			{#if data.proposal?.tasks.length}
				<Card.Root class="rounded-2xl border border-border bg-card shadow-none">
					<Card.Header>
						<Card.Title>Proposed seven-day plan</Card.Title>
						<Card.Description>
							The PDF explains the priorities; these controls apply them to your active plan.
						</Card.Description>
					</Card.Header>
					<Card.Content class="space-y-3">
						{#each data.proposal.tasks as task, index (task.id)}
							<div
								class="flex min-w-0 items-start justify-between gap-3 border-b border-border py-3 last:border-b-0 max-[560px]:flex-wrap"
							>
								<div class="min-w-0 flex-1">
									<p class="font-medium">Day {index + 1} · {task.apClass} · {task.unit}</p>
									<p class="text-xs text-muted-foreground">
										{formatDateOnly(task.date)} · {task.durationMinutes} min · {task.mode.toUpperCase()}
									</p>
								</div>
								{#if task.practiceHref}<Button
										href={task.practiceHref}
										size="sm"
										variant="outline"
										class="max-[560px]:ml-auto"><BookOpenIcon size={13} /> Practice</Button
									>{/if}
							</div>
						{/each}
						<div class="border-t border-border pt-4">
							<p class="mt-0 mb-3 text-sm font-medium">
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

			<Card.Root class="rounded-2xl border border-border bg-card shadow-none">
				<Card.Header>
					<Card.Title>Active weekly study plan</Card.Title>
					<Card.Description>One active plan. Every task is capped at 30 minutes.</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-3">
					{#if data.plan}
						{#each data.plan.tasks as task (task.id)}
							<div
								class="flex min-w-0 items-start justify-between gap-3 border-b border-border py-3 last:border-b-0 max-[560px]:flex-wrap"
							>
								<div class="min-w-0 flex-1">
									<p class="font-medium" class:line-through={task.status === 'done'}>
										{task.apClass} · {task.unit}
									</p>
									<p class="text-xs text-muted-foreground">
										{formatDateOnly(task.date)} · {task.durationMinutes} min · {task.mode.toUpperCase()}
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

			<Card.Root
				class="col-span-2 rounded-2xl border border-border bg-card shadow-none max-[720px]:col-span-1"
			>
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
						<select
							bind:value={feedbackReason}
							class="w-full rounded-[0.4rem] border border-input bg-background px-3 py-2 text-sm text-foreground"
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
		</section>

		{#if data.planAudits.length}
			<Card.Root class="rounded-2xl border border-border bg-card shadow-none">
				<Card.Header>
					<Card.Title>Recent plan changes</Card.Title>
					<Card.Description
						>Plan changes are retained for 90 days and can be undone.</Card.Description
					>
				</Card.Header>
				<Card.Content class="space-y-2">
					{#each data.planAudits as audit (audit.id)}
						<div
							class="flex min-w-0 items-start justify-between gap-3 border-b border-border py-3 last:border-b-0 max-[560px]:flex-wrap"
						>
							<p class="m-0 min-w-0 text-sm">
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
									class="max-[560px]:ml-auto"
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
