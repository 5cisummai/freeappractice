<script lang="ts">
	import { on } from 'svelte/events';
	import ThumbDownIcon from '@tabler/icons-svelte/icons/thumb-down';
	import ThumbUpIcon from '@tabler/icons-svelte/icons/thumb-up';
	import type {
		HumanReviewItem,
		QualityDashboardSnapshot,
		QualityJobSummary,
		QualityVerdict,
		ReviewFilters,
		ReviewJobStatus,
		ReviewPreview
	} from '$lib/question-bank/quality/types.js';
	import RichText from '$lib/components/content/rich-text.svelte';
	import QuestionCard from '$lib/components/questions/question-card.svelte';
	import { unlimitedQuestionCardModel } from '$lib/question-bank/question-card-model.js';
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
	let dragOffset = $state(0);
	let dragging = $state(false);
	let swipeQuestionId = $state<string | null>(null);
	let swipeDecision = $state<QualityVerdict | null>(null);

	const activeReviewItem = $derived(dashboard.humanQueue[0] ?? null);
	const nextReviewItem = $derived(dashboard.humanQueue[1] ?? null);
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

	function formatReason(value: string): string {
		return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
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

	function cardTransform(item: HumanReviewItem): string | undefined {
		if (swipeQuestionId === item.questionId && swipeDecision === 'good') {
			return 'transform: translateX(115%) rotate(12deg);';
		}
		if (swipeQuestionId === item.questionId && swipeDecision === 'bad') {
			return 'transform: translateX(-115%) rotate(-12deg);';
		}
		if (dragging && dragOffset !== 0) {
			const rotation = Math.max(-12, Math.min(12, dragOffset / 24));
			return `transform: translateX(${dragOffset}px) rotate(${rotation}deg);`;
		}
		return undefined;
	}

	function cardSwipeClasses(item: HumanReviewItem): string {
		return swipeQuestionId === item.questionId && swipeDecision
			? 'opacity-0 transition-[transform,opacity] duration-300 ease-out'
			: dragging
				? 'transition-none'
				: 'transition-[transform,opacity] duration-300 ease-out';
	}

	function swipeCard(node: HTMLElement): () => void {
		let pointerId: number | null = null;
		let startX: number | null = null;

		function handlePointerDown(event: PointerEvent): void {
			if (busyAction || !activeReviewItem) return;
			startX = event.clientX;
			pointerId = event.pointerId;
			dragging = true;
			node.setPointerCapture(event.pointerId);
		}

		function handlePointerMove(event: PointerEvent): void {
			if (startX === null || event.pointerId !== pointerId) return;
			dragOffset = event.clientX - startX;
		}

		function resetDrag(event?: PointerEvent): void {
			if (event && node.hasPointerCapture(event.pointerId))
				node.releasePointerCapture(event.pointerId);
			startX = null;
			pointerId = null;
			dragging = false;
			dragOffset = 0;
		}

		function handlePointerEnd(event: PointerEvent): void {
			if (startX === null || event.pointerId !== pointerId) return;
			const offset = dragOffset;
			resetDrag(event);
			if (!busyAction && activeReviewItem && Math.abs(offset) >= 120) {
				void submitHumanDecision(activeReviewItem, offset > 0 ? 'good' : 'bad');
			}
		}

		const cleanup = [
			on(node, 'pointerdown', handlePointerDown),
			on(node, 'pointermove', handlePointerMove),
			on(node, 'pointerup', handlePointerEnd),
			on(node, 'pointercancel', () => resetDrag())
		];

		return () => cleanup.forEach((remove) => remove());
	}

	function handleGlobalKeydown(event: KeyboardEvent): void {
		if (!activeReviewItem || busyAction || event.repeat) return;
		if (
			event.target instanceof HTMLElement &&
			event.target.closest('input, textarea, select, button')
		) {
			return;
		}
		if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
			event.preventDefault();
			void submitHumanDecision(activeReviewItem, event.key === 'ArrowRight' ? 'good' : 'bad');
		}
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
		swipeQuestionId = item.questionId;
		swipeDecision = verdict;
		clearMessages();
		await new Promise<void>((resolve) => setTimeout(resolve, 240));
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
			swipeQuestionId = null;
			swipeDecision = null;
			dragOffset = 0;
		}
	}
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<div class="space-y-6">
	<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
		<div>
			<p class="text-sm font-medium">Question quality</p>
			<h2 class="mt-1 text-2xl font-semibold tracking-tight">Review queue</h2>
			<p class="mt-1 text-sm text-muted-foreground">
				Make a quick decision on one question at a time.
			</p>
		</div>
		<Button variant="outline" onclick={() => void refreshDashboard()} disabled={!!busyAction}>
			{isBusy('dashboard-refresh') ? 'Refreshing…' : 'Refresh'}
		</Button>
	</div>

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

	<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
		<Card.Root class="rounded-2xl border border-border/60 p-4 shadow-sm">
			<p class="text-sm text-muted-foreground">Unreviewed</p>
			<p class="mt-2 text-3xl font-semibold tracking-tight">
				{dashboard.counts.unreviewed.toLocaleString()}
			</p>
			<p class="mt-1 text-xs text-muted-foreground">Not yet assessed</p>
		</Card.Root>
		<Card.Root class="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-sm">
			<p class="text-sm text-muted-foreground">Good</p>
			<p class="mt-2 text-3xl font-semibold tracking-tight text-emerald-700 dark:text-emerald-300">
				{dashboard.counts.good.toLocaleString()}
			</p>
			<p class="mt-1 text-xs text-muted-foreground">Accepted questions</p>
		</Card.Root>
		<Card.Root class="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 shadow-sm">
			<p class="text-sm text-muted-foreground">Bad</p>
			<p class="mt-2 text-3xl font-semibold tracking-tight text-destructive">
				{dashboard.counts.bad.toLocaleString()}
			</p>
			<p class="mt-1 text-xs text-muted-foreground">Rejected questions</p>
		</Card.Root>
		<Card.Root class="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 shadow-sm">
			<p class="text-sm text-muted-foreground">Need review</p>
			<p class="mt-2 text-3xl font-semibold tracking-tight text-amber-700 dark:text-amber-300">
				{dashboard.counts.awaitingHuman.toLocaleString()}
			</p>
			<p class="mt-1 text-xs text-muted-foreground">Waiting for your decision</p>
		</Card.Root>
	</div>

	<Card.Root class="rounded-2xl border border-border/60 shadow-sm">
		<Card.Header class="border-b border-border/70">
			<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<Card.Title>Human review</Card.Title>
					<Card.Description
						>Swipe right for Good, left for Bad. You can also use the buttons or arrow keys.</Card.Description
					>
				</div>
				<span
					class="w-fit rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-700 dark:text-amber-300"
				>
					{dashboard.counts.awaitingHuman.toLocaleString()} need review
				</span>
			</div>
		</Card.Header>
		<Card.Content class="p-4 sm:p-6">
			{#if activeReviewItem}
				<div class="mx-auto max-w-3xl">
					<div class="relative min-h-136">
						{#if nextReviewItem}
							<div
								class="absolute inset-x-3 top-3 h-full rounded-2xl border border-border/50 bg-muted/50 shadow-sm"
								aria-hidden="true"
							></div>
						{/if}

						<article
							{@attach swipeCard}
							class={`relative min-h-136 cursor-grab touch-pan-y rounded-2xl border border-border bg-background p-5 shadow-lg active:cursor-grabbing sm:p-7 ${cardSwipeClasses(activeReviewItem)}`}
							style={cardTransform(activeReviewItem)}
							role="group"
							aria-label={`Review question ${activeReviewItem.questionId}`}
						>
							{#if swipeQuestionId === activeReviewItem.questionId && swipeDecision}
								<div
									class={`absolute top-6 left-1/2 z-10 -translate-x-1/2 rounded-full border px-4 py-1.5 text-sm font-semibold tracking-[0.18em] uppercase ${swipeDecision === 'good' ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'border-destructive/30 bg-destructive/15 text-destructive'}`}
								>
									{swipeDecision === 'good' ? 'Good' : 'Bad'}
								</div>
							{/if}

							<div
								class="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-7 sm:pt-7"
							>
								<div class="flex flex-wrap items-center gap-2">
									<span class="rounded-full bg-muted px-3 py-1 text-xs font-medium"
										>{activeReviewItem.apClass ?? 'Unknown AP class'}</span
									>
									{#if activeReviewItem.unit}<span class="text-xs text-muted-foreground"
											>{activeReviewItem.unit}</span
										>{/if}
								</div>
								<span class="font-mono text-xs text-muted-foreground"
									>{shortId(activeReviewItem.questionId)}</span
								>
							</div>

							{#key activeReviewItem.questionId}
								<QuestionCard
									model={unlimitedQuestionCardModel({
										selectedClass: activeReviewItem.apClass ?? '',
										selectedUnit: activeReviewItem.unit ?? '',
										requestVersion: 1,
										presetQuestionId: activeReviewItem.questionId
									})}
									tutorMode="hidden"
									showUtilityActions={false}
									showFirstUseHint={false}
									nextDisabled={true}
									class="border-0 bg-transparent shadow-none ring-0"
								/>
							{/key}

							<div class="px-5 pb-5 sm:px-7 sm:pb-7">
								<details class="mt-6 rounded-xl border border-border/70 bg-muted/20">
									<summary class="cursor-pointer px-4 py-3 text-sm font-medium"
										>Show review context</summary
									>
									<div class="space-y-4 border-t border-border/70 px-4 py-4">
										{#if activeReviewItem.blind}
											<p
												class="rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2 text-sm text-violet-800 dark:text-violet-200"
											>
												Blind review is active. Make an independent decision before seeing the AI
												assessment.
											</p>
										{:else if activeReviewItem.aiAssessment}
											<div class="space-y-3">
												<div class="flex flex-wrap items-center gap-2">
													<p class="text-sm font-medium">AI assessment</p>
													<span
														class={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${verdictClasses(activeReviewItem.aiAssessment.verdict)}`}
														>{activeReviewItem.aiAssessment.verdict}</span
													>
													<span class="text-xs text-muted-foreground"
														>{formatConfidence(activeReviewItem.aiAssessment.confidence)} confidence ·
														{activeReviewItem.aiAssessment.model}</span
													>
												</div>
												{#if activeReviewItem.aiAssessment.issueCodes.length > 0}<p class="text-sm">
														<span class="font-medium">Issues:</span>
														{activeReviewItem.aiAssessment.issueCodes.join(', ')}
													</p>{/if}
												{#if activeReviewItem.aiAssessment.evidence.length > 0}
													<ul class="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
														{#each activeReviewItem.aiAssessment.evidence as evidence (evidence)}<li
															>
																{evidence}
															</li>{/each}
													</ul>
												{/if}
											</div>
										{/if}

										{#if activeReviewItem.explanation}
											<div class="border-t border-border/70 pt-3">
												<p class="mb-2 text-sm font-medium">Explanation</p>
												<RichText
													text={activeReviewItem.explanation}
													class="text-sm leading-6 text-muted-foreground"
												/>
											</div>
										{/if}

										<div
											class="flex flex-wrap gap-x-4 gap-y-1 border-t border-border/70 pt-3 text-xs text-muted-foreground"
										>
											<span>Answer reports: {activeReviewItem.feedbackSummary.answerIncorrect}</span
											>
											<span
												>Clarity reports: {activeReviewItem.feedbackSummary.questionUnclear}</span
											>
											<span
												>Explanation reports: {activeReviewItem.feedbackSummary
													.explanationUnclear}</span
											>
											<span
												>Unique reporters: {activeReviewItem.feedbackSummary.uniqueReporters}</span
											>
										</div>

										<div class="space-y-2">
											<Label for={noteId(activeReviewItem.questionId)}>Reviewer notes</Label>
											<textarea
												id={noteId(activeReviewItem.questionId)}
												class="min-h-20 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
												placeholder="Optional context for the audit trail"
												value={humanNotes[activeReviewItem.questionId] ?? ''}
												oninput={(event) => updateNote(activeReviewItem.questionId, event)}
											></textarea>
										</div>
									</div>
								</details>

								<div
									class="mt-6 flex flex-col gap-3 border-t border-border/70 pt-5 sm:flex-row sm:items-center sm:justify-between"
								>
									<p class="text-xs text-muted-foreground">Drag the card or choose a decision.</p>
									<div class="flex gap-3">
										<Button
											variant="outline"
											class="min-w-28 gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
											onclick={() => void submitHumanDecision(activeReviewItem, 'bad')}
											disabled={!!busyAction}
										>
											<ThumbDownIcon size={17} />
											{isBusy(`decision:${activeReviewItem.questionId}`) && swipeDecision === 'bad'
												? 'Saving…'
												: 'Bad'}
										</Button>
										<Button
											class="min-w-28 gap-2 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400"
											onclick={() => void submitHumanDecision(activeReviewItem, 'good')}
											disabled={!!busyAction}
										>
											<ThumbUpIcon size={17} />
											{isBusy(`decision:${activeReviewItem.questionId}`) && swipeDecision === 'good'
												? 'Saving…'
												: 'Good'}
										</Button>
									</div>
								</div>
							</div>
						</article>
					</div>
				</div>
			{:else}
				<div class="rounded-xl border border-dashed border-border/70 p-10 text-center">
					<p class="text-lg font-medium">All caught up</p>
					<p class="mt-1 text-sm text-muted-foreground">
						There are no questions waiting for a human decision.
					</p>
				</div>
			{/if}
		</Card.Content>
	</Card.Root>

	<details class="group rounded-2xl border border-border/60 shadow-sm">
		<summary
			class="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden"
		>
			<div>
				<p class="font-medium">Review operations</p>
				<p class="mt-1 text-sm text-muted-foreground">
					Start automated runs and manage previous jobs.
				</p>
			</div>
			<span class="text-xl text-muted-foreground transition-transform group-open:rotate-180">⌄</span
			>
		</summary>
		<div class="space-y-6 border-t border-border/70 p-4 sm:p-6">
			<Card.Root class="rounded-2xl border border-border/60 shadow-sm">
				<Card.Header class="border-b border-border/70">
					<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
						<div>
							<Card.Title>Run a quality review</Card.Title>
							<Card.Description
								>Preview an age-filtered batch. Approval is required before submission.</Card.Description
							>
						</div>
						<div class="text-left sm:text-right">
							<p class="text-xs tracking-[0.08em] text-muted-foreground uppercase">Model</p>
							<p class="mt-1 font-mono text-sm">{dashboard.model || 'Unknown'}</p>
						</div>
					</div>
				</Card.Header>
				<Card.Content class="space-y-5 p-6">
					<form
						class="grid gap-4 md:grid-cols-2 xl:grid-cols-6"
						onsubmit={(event) => {
							event.preventDefault();
							void previewRun();
						}}
					>
						<div class="space-y-2">
							<Label for="quality-ap-class">AP class</Label><Input
								id="quality-ap-class"
								bind:value={apClass}
								placeholder="e.g. AP Biology"
								autocomplete="off"
							/>
						</div>
						<div class="space-y-2">
							<Label for="quality-unit">Unit</Label><Input
								id="quality-unit"
								bind:value={unit}
								placeholder="e.g. Unit 3"
								autocomplete="off"
							/>
						</div>
						<div class="space-y-2">
							<Label for="quality-min-age">Minimum age (days)</Label><Input
								id="quality-min-age"
								type="number"
								min="0"
								bind:value={minimumAgeDays}
							/>
						</div>
						<div class="space-y-2">
							<Label for="quality-created-after">Created after</Label><Input
								id="quality-created-after"
								type="date"
								bind:value={createdAfter}
							/>
						</div>
						<div class="space-y-2">
							<Label for="quality-created-before">Created before</Label><Input
								id="quality-created-before"
								type="date"
								bind:value={createdBefore}
							/>
						</div>
						<div class="space-y-2">
							<Label for="quality-max-count">Maximum questions</Label><Input
								id="quality-max-count"
								type="number"
								min="1"
								max="10000"
								bind:value={maxCount}
							/>
						</div>
						<div class="md:col-span-2 xl:col-span-6">
							<Button type="submit" disabled={!!busyAction}
								>{isBusy('preview') ? 'Building preview…' : 'Preview run'}</Button
							>
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
									>{isBusy('create') ? 'Starting…' : 'Approve & start'}</Button
								>
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
						</div>
					{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root class="rounded-2xl border border-border/60 shadow-sm">
				<Card.Header class="border-b border-border/70">
					<Card.Title>Recent review jobs</Card.Title>
					<Card.Description>Refresh active jobs to advance processing.</Card.Description>
				</Card.Header>
				<Card.Content class="overflow-x-auto p-0">
					<Table.Root>
						<Table.Header
							><Table.Row
								><Table.Head>Job</Table.Head><Table.Head>Status</Table.Head><Table.Head
									class="text-right">Selected</Table.Head
								><Table.Head class="text-right">Awaiting</Table.Head><Table.Head class="text-right"
									>Progress</Table.Head
								><Table.Head class="text-right">Cost</Table.Head><Table.Head>Created</Table.Head
								><Table.Head class="text-right">Controls</Table.Head></Table.Row
							></Table.Header
						>
						<Table.Body>
							{#each dashboard.jobs as job (job.id)}
								<Table.Row>
									<Table.Cell
										><p class="font-mono text-xs">{shortId(job.id)}</p>
										{#if job.error}<p class="mt-1 max-w-48 text-xs text-destructive">
												{job.error}
											</p>{/if}</Table.Cell
									>
									<Table.Cell
										><span
											class={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusClasses(job.status)}`}
											>{job.status.replaceAll('_', ' ')}</span
										></Table.Cell
									>
									<Table.Cell class="text-right">{job.selectedCount.toLocaleString()}</Table.Cell>
									<Table.Cell class="text-right"
										>{job.awaitingHumanCount.toLocaleString()}</Table.Cell
									>
									<Table.Cell class="text-right text-xs leading-5"
										>{job.queuedCount.toLocaleString()} queued<br
										/>{job.submittedCount.toLocaleString()} submitted<br
										/>{job.finalCount.toLocaleString()} final</Table.Cell
									>
									<Table.Cell class="text-right">{formatCost(job.actualCostUsd)}</Table.Cell>
									<Table.Cell class="text-xs whitespace-nowrap"
										>{formatDateTime(job.createdAt)}</Table.Cell
									>
									<Table.Cell
										><div class="flex min-w-48 flex-wrap justify-end gap-2">
											<Button
												size="sm"
												variant="outline"
												onclick={() => void runJobAction(job, 'refresh')}
												disabled={!!busyAction || isTerminal(job.status)}
												>{isBusy(`refresh:${job.id}`) ? 'Refreshing…' : 'Refresh'}</Button
											>{#if job.status === 'preparing' || job.status === 'in_progress'}<Button
													size="sm"
													variant="outline"
													onclick={() => void runJobAction(job, 'pause')}
													disabled={!!busyAction}>Pause</Button
												>{:else if job.status === 'paused'}<Button
													size="sm"
													variant="outline"
													onclick={() => void runJobAction(job, 'resume')}
													disabled={!!busyAction}>Resume</Button
												>{/if}{#if !isTerminal(job.status) && job.status !== 'awaiting_human'}<Button
													size="sm"
													variant="destructive"
													onclick={() => void runJobAction(job, 'cancel')}
													disabled={!!busyAction}>Cancel</Button
												>{/if}
										</div></Table.Cell
									>
								</Table.Row>
							{:else}
								<Table.Row
									><Table.Cell colspan={8} class="h-24 text-center text-muted-foreground"
										>No review jobs yet.</Table.Cell
									></Table.Row
								>
							{/each}
						</Table.Body>
					</Table.Root>
				</Card.Content>
			</Card.Root>
		</div>
	</details>
</div>
