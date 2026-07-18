<script lang="ts">
	import type {
		HumanReviewItem,
		QualityDashboardSnapshot,
		QualityJobSummary,
		QualityVerdict,
		ReviewFilters,
		ReviewJobStatus,
		ReviewPreview
	} from '$lib/question-quality/types.js';
	import RichText from '$lib/components/content/rich-text.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Table from '$lib/components/ui/table/index.js';

	type Props = {
		snapshot: QualityDashboardSnapshot;
	};

	type NumericInput = number | string | undefined;

	let { snapshot }: Props = $props();

	function initialDashboard(): QualityDashboardSnapshot {
		return snapshot;
	}

	let dashboard = $state<QualityDashboardSnapshot>(initialDashboard());
	let apClass = $state('');
	let unit = $state('');
	let createdAfter = $state('');
	let createdBefore = $state('');
	let minimumAgeDays = $state<NumericInput>(7);
	let maxCount = $state<NumericInput>(500);
	let preview = $state<ReviewPreview | null>(null);
	let busyAction = $state<string | null>(null);
	let statusMessage = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);
	let humanNotes = $state<Record<string, string>>({});

	const terminalJobStatuses: ReviewJobStatus[] = ['completed', 'cancelled', 'failed'];

	function numberValue(value: NumericInput, fallback: number): number {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : fallback;
	}

	function buildFilters(): ReviewFilters {
		return {
			...(apClass.trim() ? { apClass: apClass.trim() } : {}),
			...(unit.trim() ? { unit: unit.trim() } : {}),
			...(createdAfter ? { createdAfter } : {}),
			...(createdBefore ? { createdBefore } : {}),
			qualityState: 'unreviewed',
			minimumAgeDays: Math.max(0, numberValue(minimumAgeDays, 7)),
			maxCount: Math.min(10_000, Math.max(1, Math.floor(numberValue(maxCount, 500))))
		};
	}

	function clearMessages(): void {
		statusMessage = null;
		errorMessage = null;
	}

	function payloadMessage(payload: unknown): string | null {
		if (typeof payload !== 'object' || payload === null || !('message' in payload)) return null;
		const message = payload.message;
		return typeof message === 'string' && message ? message : null;
	}

	async function request<T>(body?: Record<string, unknown>): Promise<T> {
		const response = await fetch('/api/admin/question-quality', {
			method: body ? 'POST' : 'GET',
			...(body
				? {
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify(body)
					}
				: {})
		});
		const raw = await response.text();
		let payload: unknown = null;
		if (raw) {
			try {
				payload = JSON.parse(raw);
			} catch {
				payload = raw;
			}
		}
		if (!response.ok) {
			throw new Error(
				payloadMessage(payload) ??
					((typeof payload === 'string' && payload) ||
						`Request failed with status ${response.status}`)
			);
		}
		return payload as T;
	}

	function upsertJob(job: QualityJobSummary): void {
		dashboard = {
			...dashboard,
			jobs: [job, ...dashboard.jobs.filter((current) => current.id !== job.id)]
		};
	}

	function formatDateTime(value: Date | string | null | undefined): string {
		const date = new Date(value ?? '');
		if (Number.isNaN(date.getTime())) return '-';
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		}).format(date);
	}

	function formatCost(value: number): string {
		return `$${value.toFixed(4)}`;
	}

	function formatConfidence(value: number): string {
		return `${Math.round(value * 100)}%`;
	}

	function shortId(value: string): string {
		return value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
	}

	function statusClasses(status: ReviewJobStatus): string {
		if (status === 'completed')
			return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
		if (status === 'failed') return 'border-destructive/20 bg-destructive/10 text-destructive';
		if (status === 'cancelled') return 'border-border bg-muted text-muted-foreground';
		if (status === 'awaiting_human')
			return 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300';
		return 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300';
	}

	function verdictClasses(verdict: QualityVerdict): string {
		return verdict === 'good'
			? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
			: 'border-destructive/20 bg-destructive/10 text-destructive';
	}

	function isTerminal(status: ReviewJobStatus): boolean {
		return terminalJobStatuses.includes(status);
	}

	function isBusy(key: string): boolean {
		return busyAction === key;
	}

	async function previewRun(): Promise<void> {
		if (busyAction) return;
		busyAction = 'preview';
		preview = null;
		clearMessages();
		try {
			preview = await request<ReviewPreview>({ action: 'preview', filters: buildFilters() });
			statusMessage = `Preview ready for ${preview.selectedCount.toLocaleString()} question(s).`;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Unable to preview this run.';
		} finally {
			busyAction = null;
		}
	}

	async function approveAndStart(): Promise<void> {
		if (!preview || busyAction) return;
		busyAction = 'create';
		clearMessages();
		try {
			const job = await request<QualityJobSummary>({
				action: 'create',
				previewId: preview.previewId
			});
			upsertJob(job);
			preview = null;
			statusMessage = `Review job ${shortId(job.id)} started.`;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Unable to start this review job.';
		} finally {
			busyAction = null;
		}
	}

	async function refreshDashboard(): Promise<void> {
		if (busyAction) return;
		busyAction = 'dashboard-refresh';
		clearMessages();
		try {
			dashboard = await request<QualityDashboardSnapshot>();
			statusMessage = 'Dashboard refreshed.';
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Unable to refresh the dashboard.';
		} finally {
			busyAction = null;
		}
	}

	async function runJobAction(
		job: QualityJobSummary,
		action: 'refresh' | 'pause' | 'resume' | 'cancel'
	): Promise<void> {
		const key = `${action}:${job.id}`;
		if (busyAction) return;
		busyAction = key;
		clearMessages();
		try {
			const updatedJob = await request<QualityJobSummary>({ action, jobId: job.id });
			upsertJob(updatedJob);
			const pastTense: Record<typeof action, string> = {
				refresh: 'Refreshed',
				pause: 'Paused',
				resume: 'Resumed',
				cancel: 'Cancelled'
			};
			statusMessage = `${pastTense[action]} job ${shortId(job.id)}.`;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : `Unable to ${action} this job.`;
		} finally {
			busyAction = null;
		}
	}

	function noteId(questionId: string): string {
		return `quality-note-${questionId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
	}

	function updateNote(questionId: string, event: Event): void {
		const target = event.currentTarget as HTMLTextAreaElement;
		humanNotes[questionId] = target.value;
	}

	async function submitHumanDecision(
		item: HumanReviewItem,
		verdict: QualityVerdict
	): Promise<void> {
		const key = `decision:${item.questionId}`;
		if (busyAction) return;
		busyAction = key;
		clearMessages();
		try {
			await request({
				action: 'humanDecision',
				questionId: item.questionId,
				verdict,
				notes: humanNotes[item.questionId]?.trim() ?? ''
			});
			dashboard = await request<QualityDashboardSnapshot>();
			delete humanNotes[item.questionId];
			statusMessage = `${verdict === 'good' ? 'Good' : 'Bad'} decision saved for ${shortId(item.questionId)}.`;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Unable to save this human decision.';
		} finally {
			busyAction = null;
		}
	}
</script>

<div class="space-y-6">
	<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
		<div>
			<p class="text-sm font-medium">Question quality operations</p>
			<p class="mt-1 text-sm text-muted-foreground">
				Preview an age-filtered batch, approve its cost, and resolve questions that need a human.
			</p>
		</div>
		<Button variant="outline" onclick={() => void refreshDashboard()} disabled={!!busyAction}>
			{isBusy('dashboard-refresh') ? 'Refreshing…' : 'Refresh dashboard'}
		</Button>
	</div>
	<p
		class="rounded-lg border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-800 dark:text-sky-200"
	>
		Observation only: Good and Bad labels do not change generation, caching, or which questions
		students receive.
	</p>

	{#if statusMessage}
		<p
			class="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300"
			role="status"
		>
			{statusMessage}
		</p>
	{/if}
	{#if errorMessage}
		<p
			class="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
			role="alert"
		>
			{errorMessage}
		</p>
	{/if}

	<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
		<Card.Root class="rounded-2xl border border-border/60 p-4 shadow-sm">
			<p class="text-sm text-muted-foreground">Unreviewed</p>
			<p class="mt-2 text-3xl font-semibold tracking-tight">
				{dashboard.counts.unreviewed.toLocaleString()}
			</p>
			<p class="mt-1 text-xs text-muted-foreground">Eligible for a future run</p>
		</Card.Root>
		<Card.Root class="rounded-2xl border border-border/60 p-4 shadow-sm">
			<p class="text-sm text-muted-foreground">Awaiting human</p>
			<p class="mt-2 text-3xl font-semibold tracking-tight">
				{dashboard.counts.awaitingHuman.toLocaleString()}
			</p>
			<p class="mt-1 text-xs text-muted-foreground">Needs a final decision</p>
		</Card.Root>
		<Card.Root class="rounded-2xl border border-border/60 p-4 shadow-sm">
			<p class="text-sm text-muted-foreground">Good</p>
			<p class="mt-2 text-3xl font-semibold tracking-tight text-emerald-700 dark:text-emerald-300">
				{dashboard.counts.good.toLocaleString()}
			</p>
			<p class="mt-1 text-xs text-muted-foreground">Final accepted quality</p>
		</Card.Root>
		<Card.Root class="rounded-2xl border border-border/60 p-4 shadow-sm">
			<p class="text-sm text-muted-foreground">Bad</p>
			<p class="mt-2 text-3xl font-semibold tracking-tight text-destructive">
				{dashboard.counts.bad.toLocaleString()}
			</p>
			<p class="mt-1 text-xs text-muted-foreground">Final rejected quality</p>
		</Card.Root>
		<Card.Root class="rounded-2xl border border-border/60 p-4 shadow-sm">
			<p class="text-sm text-muted-foreground">High priority</p>
			<p class="mt-2 text-3xl font-semibold tracking-tight">
				{dashboard.counts.highPriority.toLocaleString()}
			</p>
			<p class="mt-1 text-xs text-muted-foreground">Escalated feedback</p>
		</Card.Root>
	</div>

	<Card.Root class="rounded-2xl border border-border/60 shadow-sm">
		<Card.Header class="border-b border-border/70">
			<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<Card.Title>Run a quality review</Card.Title>
					<Card.Description
						>Start with a read-only estimate. Approval is required before any batch is submitted.</Card.Description
					>
				</div>
				<div class="text-left sm:text-right">
					<p class="text-xs tracking-[0.08em] text-muted-foreground uppercase">Model</p>
					<p class="mt-1 font-mono text-sm">{dashboard.model || 'Unknown'}</p>
				</div>
			</div>
		</Card.Header>
		<Card.Content class="space-y-5 p-6">
			{#if !dashboard.calibrated}
				<div
					class="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200"
					role="note"
				>
					<p class="font-medium">Model calibration is not complete.</p>
					<p class="mt-1">
						Every AI assessment will require a human decision; the 5% calibration sample hides AI
						evidence until the specialist decides.
					</p>
				</div>
			{:else}
				<div
					class="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300"
				>
					Model calibration is active for new reviews.
				</div>
			{/if}

			<form
				class="grid gap-4 md:grid-cols-2 xl:grid-cols-6"
				onsubmit={(event) => {
					event.preventDefault();
					void previewRun();
				}}
			>
				<div class="space-y-2">
					<Label for="quality-ap-class">AP class</Label>
					<Input
						id="quality-ap-class"
						bind:value={apClass}
						placeholder="e.g. AP Biology"
						autocomplete="off"
					/>
				</div>
				<div class="space-y-2">
					<Label for="quality-unit">Unit</Label>
					<Input id="quality-unit" bind:value={unit} placeholder="e.g. Unit 3" autocomplete="off" />
				</div>
				<div class="space-y-2">
					<Label for="quality-min-age">Minimum age (days)</Label>
					<Input id="quality-min-age" type="number" min="0" bind:value={minimumAgeDays} />
				</div>
				<div class="space-y-2">
					<Label for="quality-created-after">Created after</Label>
					<Input id="quality-created-after" type="date" bind:value={createdAfter} />
				</div>
				<div class="space-y-2">
					<Label for="quality-created-before">Created before</Label>
					<Input id="quality-created-before" type="date" bind:value={createdBefore} />
				</div>
				<div class="space-y-2">
					<Label for="quality-max-count">Maximum questions</Label>
					<Input id="quality-max-count" type="number" min="1" max="10000" bind:value={maxCount} />
				</div>
				<div class="md:col-span-2 xl:col-span-6">
					<Button type="submit" disabled={!!busyAction}>
						{isBusy('preview') ? 'Building preview…' : 'Preview run'}
					</Button>
					<p class="mt-2 text-xs text-muted-foreground">
						Quality state is locked to Unreviewed in V1 to prevent duplicate labeling.
					</p>
				</div>
			</form>

			{#if preview}
				<div class="rounded-xl border border-border/70 bg-muted/30 p-4">
					<div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
						<div>
							<p class="font-medium">Preview ready</p>
							<p class="mt-1 text-sm text-muted-foreground">
								This preview expires {formatDateTime(preview.expiresAt)}. No questions have been
								submitted yet.
							</p>
						</div>
						<Button
							onclick={() => void approveAndStart()}
							disabled={!!busyAction || preview.selectedCount === 0}
						>
							{isBusy('create') ? 'Starting…' : 'Approve & start'}
						</Button>
					</div>
					<div class="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
						<div>
							<p class="text-muted-foreground">Selected</p>
							<p class="mt-1 font-semibold">{preview.selectedCount.toLocaleString()}</p>
						</div>
						<div>
							<p class="text-muted-foreground">Skipped</p>
							<p class="mt-1 font-semibold">{preview.skippedCount.toLocaleString()}</p>
						</div>
						<div>
							<p class="text-muted-foreground">Input tokens</p>
							<p class="mt-1 font-semibold">{preview.estimatedInputTokens.toLocaleString()}</p>
						</div>
						<div>
							<p class="text-muted-foreground">Output tokens</p>
							<p class="mt-1 font-semibold">{preview.estimatedOutputTokens.toLocaleString()}</p>
						</div>
						<div>
							<p class="text-muted-foreground">Estimated max cost</p>
							<p class="mt-1 font-semibold">{formatCost(preview.estimatedMaximumCostUsd)}</p>
						</div>
					</div>
					{#if !preview.calibrated}
						<p class="mt-4 text-xs text-amber-700 dark:text-amber-300">
							This preview includes the uncalibrated-model warning and may create blind calibration
							samples.
						</p>
					{/if}
				</div>
			{/if}
		</Card.Content>
	</Card.Root>

	<Card.Root class="rounded-2xl border border-border/60 shadow-sm">
		<Card.Header class="border-b border-border/70">
			<Card.Title>Recent review jobs</Card.Title>
			<Card.Description
				>Refresh active jobs to advance batch processing and keep counts current.</Card.Description
			>
		</Card.Header>
		<Card.Content class="p-0">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Job</Table.Head>
						<Table.Head>Status</Table.Head>
						<Table.Head class="text-right">Selected</Table.Head>
						<Table.Head class="text-right">Awaiting</Table.Head>
						<Table.Head class="text-right">Progress</Table.Head>
						<Table.Head class="text-right">Cost</Table.Head>
						<Table.Head>Created</Table.Head>
						<Table.Head class="text-right">Controls</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each dashboard.jobs as job (job.id)}
						<Table.Row>
							<Table.Cell>
								<p class="font-mono text-xs">{shortId(job.id)}</p>
								{#if job.error}<p class="mt-1 max-w-48 text-xs text-destructive">
										{job.error}
									</p>{/if}
							</Table.Cell>
							<Table.Cell>
								<span
									class={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusClasses(job.status)}`}
								>
									{job.status.replaceAll('_', ' ')}
								</span>
							</Table.Cell>
							<Table.Cell class="text-right">{job.selectedCount.toLocaleString()}</Table.Cell>
							<Table.Cell class="text-right">{job.awaitingHumanCount.toLocaleString()}</Table.Cell>
							<Table.Cell class="text-right text-xs leading-5">
								{job.queuedCount.toLocaleString()} queued<br />
								{job.submittedCount.toLocaleString()} submitted<br />
								{job.finalCount.toLocaleString()} final
							</Table.Cell>
							<Table.Cell class="text-right">{formatCost(job.actualCostUsd)}</Table.Cell>
							<Table.Cell class="text-xs whitespace-nowrap"
								>{formatDateTime(job.createdAt)}</Table.Cell
							>
							<Table.Cell>
								<div class="flex min-w-48 flex-wrap justify-end gap-2">
									<Button
										size="sm"
										variant="outline"
										onclick={() => void runJobAction(job, 'refresh')}
										disabled={!!busyAction || isTerminal(job.status)}
									>
										{isBusy(`refresh:${job.id}`) ? 'Refreshing…' : 'Refresh'}
									</Button>
									{#if job.status === 'preparing' || job.status === 'in_progress'}
										<Button
											size="sm"
											variant="outline"
											onclick={() => void runJobAction(job, 'pause')}
											disabled={!!busyAction}>Pause</Button
										>
									{:else if job.status === 'paused'}
										<Button
											size="sm"
											variant="outline"
											onclick={() => void runJobAction(job, 'resume')}
											disabled={!!busyAction}>Resume</Button
										>
									{/if}
									{#if !isTerminal(job.status) && job.status !== 'awaiting_human'}
										<Button
											size="sm"
											variant="destructive"
											onclick={() => void runJobAction(job, 'cancel')}
											disabled={!!busyAction}>Cancel</Button
										>
									{/if}
								</div>
							</Table.Cell>
						</Table.Row>
					{:else}
						<Table.Row>
							<Table.Cell colspan={8} class="h-24 text-center text-muted-foreground"
								>No review jobs yet.</Table.Cell
							>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>

	<Card.Root class="rounded-2xl border border-border/60 shadow-sm">
		<Card.Header class="border-b border-border/70">
			<Card.Title>Human review queue</Card.Title>
			<Card.Description
				>Make a final Good or Bad decision. Blind items intentionally omit the AI assessment.</Card.Description
			>
		</Card.Header>
		<Card.Content class="space-y-4 p-6">
			{#each dashboard.humanQueue as item (item.questionId)}
				<div class="rounded-xl border border-border/70 p-5">
					<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
						<div class="min-w-0">
							<div class="flex flex-wrap items-center gap-2">
								<p class="font-mono text-xs text-muted-foreground">{shortId(item.questionId)}</p>
								{#if item.blind}
									<span
										class="inline-flex rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-300"
										>Blind review</span
									>
								{/if}
								{#if item.feedbackSummary.priority === 'high'}
									<span
										class="inline-flex rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300"
										>High priority</span
									>
								{/if}
							</div>
							<p class="mt-2 font-medium">
								{item.apClass ?? 'Unknown AP class'}{item.unit ? ` · ${item.unit}` : ''}
							</p>
						</div>
						<p class="max-w-md text-sm text-muted-foreground">{item.reason.replaceAll('_', ' ')}</p>
					</div>

					<div class="mt-4 rounded-lg bg-muted/40 p-4">
						{#if item.stimulus}
							<div class="grid gap-4 lg:grid-cols-2">
								<div class="rounded-lg border border-border/60 bg-background/40 p-4">
									<p
										class="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
									>
										Stimulus
									</p>
									<RichText text={item.stimulus} class="text-sm leading-6 text-foreground/90" />
								</div>
								<div class="rounded-lg border border-border/60 bg-background/40 p-4">
									<p
										class="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
									>
										Question
									</p>
									<RichText
										text={item.question ?? 'Question text unavailable.'}
										class="text-base leading-7 text-foreground/90"
									/>
								</div>
							</div>
						{:else}
							<RichText
								text={item.question ?? 'Question text unavailable.'}
								class="text-base leading-7 text-foreground/90"
							/>
						{/if}
						{#if item.options && Object.keys(item.options).length > 0}
							<div class="mt-4 grid gap-2 sm:grid-cols-2">
								{#each Object.entries(item.options) as [key, option] (key)}
									<div
										class={`rounded-md border px-3 py-2 text-sm ${key === item.correctAnswer ? 'border-primary/40 bg-primary/5' : 'border-border/70'}`}
									>
										<div class="flex gap-3">
											<span
												class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-muted/50 text-xs font-semibold"
											>
												{key}
											</span>
											<RichText text={option} inline class="text-sm leading-6" />
										</div>
										{#if key === item.correctAnswer}<span class="ml-2 text-xs text-primary"
												>answer</span
											>{/if}
									</div>
								{/each}
							</div>
						{/if}
						{#if item.explanation}
							<div
								class="mt-4 border-t border-border/60 pt-3 text-sm leading-6 text-muted-foreground"
							>
								<p class="mb-2 font-medium text-foreground">Explanation</p>
								<RichText text={item.explanation} class="text-sm leading-6 text-foreground/90" />
							</div>
						{/if}
					</div>

					{#if item.blind}
						<div
							class="mt-4 rounded-lg border border-violet-500/20 bg-violet-500/5 px-4 py-3 text-sm text-violet-800 dark:text-violet-200"
						>
							Blind handling is active: AI verdict, evidence, and confidence are hidden for an
							independent decision.
						</div>
					{:else if item.aiAssessment}
						<div class="mt-4 rounded-lg border border-border/70 p-4">
							<div class="flex flex-wrap items-center gap-2">
								<p class="text-sm font-medium">AI assessment</p>
								<span
									class={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${verdictClasses(item.aiAssessment.verdict)}`}
									>{item.aiAssessment.verdict}</span
								>
								<span class="text-xs text-muted-foreground"
									>{formatConfidence(item.aiAssessment.confidence)} confidence · {item.aiAssessment
										.model}</span
								>
							</div>
							{#if item.aiAssessment.issueCodes.length > 0}
								<p class="mt-3 text-sm">
									<span class="font-medium">Issues:</span>
									{item.aiAssessment.issueCodes.join(', ')}
								</p>
							{/if}
							{#if item.aiAssessment.evidence.length > 0}
								<ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
									{#each item.aiAssessment.evidence as evidence (evidence)}<li>
											{evidence}
										</li>{/each}
								</ul>
							{/if}
						</div>
					{/if}

					<div class="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
						<span>Answer reports: {item.feedbackSummary.answerIncorrect}</span>
						<span>Clarity reports: {item.feedbackSummary.questionUnclear}</span>
						<span>Explanation reports: {item.feedbackSummary.explanationUnclear}</span>
						<span>Unique reporters: {item.feedbackSummary.uniqueReporters}</span>
					</div>

					<div class="mt-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
						<div class="space-y-2">
							<Label for={noteId(item.questionId)}>Reviewer notes</Label>
							<textarea
								id={noteId(item.questionId)}
								class="min-h-20 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
								placeholder="Optional context for the audit trail"
								value={humanNotes[item.questionId] ?? ''}
								oninput={(event) => updateNote(item.questionId, event)}
							></textarea>
						</div>
						<div class="flex flex-wrap gap-2 lg:justify-end">
							<Button
								variant="outline"
								class="border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
								onclick={() => void submitHumanDecision(item, 'good')}
								disabled={!!busyAction}
							>
								{isBusy(`decision:${item.questionId}`) ? 'Saving…' : 'Good'}
							</Button>
							<Button
								variant="destructive"
								onclick={() => void submitHumanDecision(item, 'bad')}
								disabled={!!busyAction}>Bad</Button
							>
						</div>
					</div>
				</div>
			{:else}
				<div
					class="rounded-xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground"
				>
					Human queue is clear.
				</div>
			{/each}
		</Card.Content>
	</Card.Root>
</div>
