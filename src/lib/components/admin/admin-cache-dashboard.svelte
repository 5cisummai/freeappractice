<script lang="ts">
	import type {
		CacheBucketSummary,
		CacheOverview,
		PoolQuestionType,
		PoolRefillStatusUi,
		RecentTopicSnapshot
	} from '$lib/admin/types.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';

	type Props = {
		overview: CacheOverview;
		buckets: CacheBucketSummary[];
		recentTopics: RecentTopicSnapshot[];
	};

	type PoolSnapshot = {
		overview: CacheOverview;
		buckets: CacheBucketSummary[];
	};

	let { overview, buckets, recentTopics }: Props = $props();

	let localOverview = $state<CacheOverview | null>(null);
	let localBuckets = $state<CacheBucketSummary[] | null>(null);
	let busyAction = $state<string | null>(null);
	let statusMessage = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);
	let typeFilter = $state<'all' | PoolQuestionType>('all');

	const liveOverview = $derived(localOverview ?? overview);
	const liveBuckets = $derived(localBuckets ?? buckets);

	const visibleBuckets = $derived(
		typeFilter === 'all'
			? liveBuckets
			: liveBuckets.filter((bucket) => bucket.questionType === typeFilter)
	);

	function healthClasses(health: CacheBucketSummary['health']): string {
		if (health === 'healthy')
			return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
		if (health === 'low')
			return 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300';
		return 'border-destructive/20 bg-destructive/10 text-destructive';
	}

	function refillClasses(status: PoolRefillStatusUi): string {
		switch (status) {
			case 'running':
				return 'border-sky-500/20 bg-sky-500/10 text-sky-800 dark:text-sky-200';
			case 'pending':
				return 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300';
			case 'failed':
			case 'budget_exhausted':
				return 'border-destructive/20 bg-destructive/10 text-destructive';
			case 'idle':
				return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
			case 'unknown':
				return 'border-border bg-muted text-muted-foreground';
			default: {
				const _exhaustive: never = status;
				return _exhaustive;
			}
		}
	}

	function formatRelativeDate(value: Date | string | null | undefined): string {
		if (!value) return '-';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '-';
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			timeZone: 'UTC'
		}).format(date);
	}

	function formatUsd(value: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			maximumFractionDigits: 2
		}).format(value);
	}

	function payloadMessage(payload: unknown): string | null {
		if (typeof payload !== 'object' || payload === null || !('message' in payload)) return null;
		const message = payload.message;
		return typeof message === 'string' && message ? message : null;
	}

	async function request<T>(body?: Record<string, unknown>): Promise<T> {
		const response = await fetch('/api/admin/question-pool', {
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

	async function refreshSnapshot(): Promise<void> {
		busyAction = 'refresh';
		statusMessage = null;
		errorMessage = null;
		try {
			const snapshot = await request<PoolSnapshot>({ action: 'refresh' });
			localOverview = snapshot.overview;
			localBuckets = snapshot.buckets;
			statusMessage = 'Pool readiness refreshed.';
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Unable to refresh pool readiness.';
		} finally {
			busyAction = null;
		}
	}

	async function enqueueAllDeficits(): Promise<void> {
		busyAction = 'enqueue-all';
		statusMessage = null;
		errorMessage = null;
		try {
			const result = await request<{ enqueued: number }>({ action: 'enqueueAllDeficits' });
			const snapshot = await request<PoolSnapshot>({ action: 'refresh' });
			localOverview = snapshot.overview;
			localBuckets = snapshot.buckets;
			statusMessage = `Enqueued ${result.enqueued} deficit bucket(s) for async refill. Generation runs via cron/worker only.`;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Unable to enqueue deficits.';
		} finally {
			busyAction = null;
		}
	}

	async function enqueueBucket(bucket: CacheBucketSummary): Promise<void> {
		const key = `${bucket.questionType}:${bucket.apClass}:${bucket.unit}`;
		busyAction = key;
		statusMessage = null;
		errorMessage = null;
		try {
			await request({
				action: 'enqueueBucket',
				questionType: bucket.questionType,
				apClass: bucket.apClass,
				unit: bucket.unit
			});
			const snapshot = await request<PoolSnapshot>({ action: 'refresh' });
			localOverview = snapshot.overview;
			localBuckets = snapshot.buckets;
			statusMessage = `Queued ${bucket.questionType.toUpperCase()} refill for ${bucket.apClass} · ${bucket.unit}.`;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Unable to enqueue this bucket.';
		} finally {
			busyAction = null;
		}
	}

	function isBusy(action: string): boolean {
		return busyAction === action;
	}
</script>

<div class="space-y-6">
	<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
		<div>
			<p class="text-sm font-medium">Question pool readiness</p>
			<p class="mt-1 text-sm text-muted-foreground">
				Active Mongo inventory, refill queue status, and estimated remaining generation cost. Admin
				actions only enqueue work — they never generate synchronously.
			</p>
		</div>
		<div class="flex flex-wrap gap-2">
			<Button variant="outline" onclick={() => void refreshSnapshot()} disabled={!!busyAction}>
				{isBusy('refresh') ? 'Refreshing…' : 'Refresh'}
			</Button>
			<Button onclick={() => void enqueueAllDeficits()} disabled={!!busyAction}>
				{isBusy('enqueue-all') ? 'Enqueueing…' : 'Enqueue all deficits'}
			</Button>
		</div>
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

	<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
		<Card.Root class="rounded-2xl border border-border/60 p-4 shadow-sm">
			<p class="text-sm text-muted-foreground">Aggregate readiness</p>
			<p class="mt-2 text-3xl font-semibold tracking-tight">{liveOverview.readinessPercent}%</p>
			<p class="mt-1 text-xs text-muted-foreground">
				{liveOverview.totalQuestions.toLocaleString()} / {liveOverview.totalTarget.toLocaleString()} toward
				targets
			</p>
		</Card.Root>
		<Card.Root class="rounded-2xl border border-border/60 p-4 shadow-sm">
			<p class="text-sm text-muted-foreground">Deficit remaining</p>
			<p class="mt-2 text-3xl font-semibold tracking-tight">
				{liveOverview.totalDeficit.toLocaleString()}
			</p>
			<p class="mt-1 text-xs text-muted-foreground">
				Est. {formatUsd(liveOverview.estimatedRemainingCostUsd)} to fill
			</p>
		</Card.Root>
		<Card.Root class="rounded-2xl border border-border/60 p-4 shadow-sm">
			<p class="text-sm text-muted-foreground">Empty / below target</p>
			<p class="mt-2 text-3xl font-semibold tracking-tight">
				{liveOverview.emptyBuckets} / {liveOverview.underTargetBuckets}
			</p>
			<p class="mt-1 text-xs text-muted-foreground">
				MCQ target {liveOverview.mcqTarget} · FRQ target {liveOverview.frqTarget}
			</p>
		</Card.Root>
		<Card.Root class="rounded-2xl border border-border/60 p-4 shadow-sm">
			<p class="text-sm text-muted-foreground">Refill queue</p>
			<p class="mt-2 text-3xl font-semibold tracking-tight">
				{liveOverview.pendingRefills + liveOverview.runningRefills}
			</p>
			<p class="mt-1 text-xs text-muted-foreground">
				{liveOverview.pendingRefills} pending · {liveOverview.runningRefills} running · {liveOverview.failedRefills}
				failed
			</p>
		</Card.Root>
	</div>

	<div class="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
		<Card.Root class="rounded-2xl border border-border/60 shadow-sm">
			<Card.Header class="border-b border-border/70">
				<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<Card.Title>Bucket readiness</Card.Title>
						<Card.Description
							>Active count, target, deficit, refill status, and estimated remaining cost.</Card.Description
						>
					</div>
					<div class="flex flex-wrap gap-2">
						<Button
							size="sm"
							variant={typeFilter === 'all' ? 'default' : 'outline'}
							onclick={() => (typeFilter = 'all')}
						>
							All
						</Button>
						<Button
							size="sm"
							variant={typeFilter === 'mcq' ? 'default' : 'outline'}
							onclick={() => (typeFilter = 'mcq')}
						>
							MCQ
						</Button>
						<Button
							size="sm"
							variant={typeFilter === 'frq' ? 'default' : 'outline'}
							onclick={() => (typeFilter = 'frq')}
						>
							FRQ
						</Button>
					</div>
				</div>
			</Card.Header>
			<Card.Content class="space-y-3 p-6">
				{#if visibleBuckets.length === 0}
					<p class="text-sm text-muted-foreground">No catalog buckets matched this filter.</p>
				{:else}
					{#each visibleBuckets.slice(0, 24) as bucket (`${bucket.questionType}-${bucket.apClass}-${bucket.unit}`)}
						<div class="rounded-xl border border-border/60 p-4">
							<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
								<div class="min-w-0">
									<p class="font-medium">
										<span class="mr-2 text-xs tracking-[0.08em] text-muted-foreground uppercase"
											>{bucket.questionType}</span
										>
										{bucket.apClass}
									</p>
									<p class="text-sm text-muted-foreground">{bucket.unit}</p>
								</div>
								<div class="flex flex-wrap items-center gap-2">
									<span
										class={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${healthClasses(bucket.health)}`}
									>
										{bucket.health}
									</span>
									<span
										class={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${refillClasses(bucket.refillStatus)}`}
									>
										{bucket.refillStatus}
									</span>
								</div>
							</div>

							<div class="mt-3 space-y-2">
								<div class="h-2 overflow-hidden rounded-full bg-muted">
									<div
										class={bucket.health === 'healthy'
											? 'h-full rounded-full bg-emerald-500'
											: bucket.health === 'low'
												? 'h-full rounded-full bg-amber-500'
												: 'h-full rounded-full bg-destructive'}
										style={`width:${bucket.fillRatio}%`}
									></div>
								</div>
								<div class="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
									<span
										>{bucket.activeCount}/{bucket.target} active (deficit {bucket.deficit})</span
									>
									<span>Est. remaining {formatUsd(bucket.estimatedRemainingCostUsd)}</span>
									<span>Last success {formatRelativeDate(bucket.lastSuccessAt)}</span>
									<span>Newest {formatRelativeDate(bucket.newestCreatedAt)}</span>
								</div>
								{#if bucket.lastError}
									<p class="text-xs text-destructive">Last error: {bucket.lastError}</p>
								{/if}
								{#if bucket.deficit > 0}
									<Button
										size="sm"
										variant="outline"
										disabled={!!busyAction}
										onclick={() => void enqueueBucket(bucket)}
									>
										{busyAction === `${bucket.questionType}:${bucket.apClass}:${bucket.unit}`
											? 'Queueing…'
											: 'Enqueue refill'}
									</Button>
								{/if}
							</div>
						</div>
					{/each}
				{/if}
			</Card.Content>
		</Card.Root>

		<div class="space-y-6">
			<Card.Root class="rounded-2xl border border-border/60 shadow-sm">
				<Card.Header class="border-b border-border/70">
					<Card.Title>Healthy inventory</Card.Title>
					<Card.Description>Buckets at or above target vs tracked catalog size.</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-4 p-6">
					<div class="grid gap-3 sm:grid-cols-3">
						<div class="rounded-xl border border-border/60 px-4 py-3">
							<p class="text-xs tracking-[0.08em] text-muted-foreground uppercase">Active</p>
							<p class="mt-2 text-2xl font-semibold tracking-tight">
								{liveOverview.totalQuestions.toLocaleString()}
							</p>
						</div>
						<div class="rounded-xl border border-border/60 px-4 py-3">
							<p class="text-xs tracking-[0.08em] text-muted-foreground uppercase">Healthy</p>
							<p class="mt-2 text-2xl font-semibold tracking-tight">{liveOverview.healthyBuckets}</p>
						</div>
						<div class="rounded-xl border border-border/60 px-4 py-3">
							<p class="text-xs tracking-[0.08em] text-muted-foreground uppercase">Tracked</p>
							<p class="mt-2 text-2xl font-semibold tracking-tight">{liveOverview.totalBuckets}</p>
						</div>
					</div>
				</Card.Content>
			</Card.Root>

			<Card.Root class="rounded-2xl border border-border/60 shadow-sm">
				<Card.Header class="border-b border-border/70">
					<Card.Title>Recent topic churn</Card.Title>
					<Card.Description>Latest topics written into the question pool.</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-3 p-6">
					{#if recentTopics.length === 0}
						<p class="text-sm text-muted-foreground">No recent topic activity recorded.</p>
					{:else}
						{#each recentTopics as topic, index (`${topic.apClass}-${topic.unit}-${topic.createdAt}-${index}`)}
							<div class="rounded-xl border border-border/60 p-4">
								<div class="flex items-start justify-between gap-3">
									<div>
										<p class="font-medium">{topic.apClass}</p>
										<p class="text-sm text-muted-foreground">{topic.unit}</p>
									</div>
									<p class="text-xs text-muted-foreground">{formatRelativeDate(topic.createdAt)}</p>
								</div>
								<p class="mt-3 text-sm leading-6 text-foreground/90">{topic.topicsCovered}</p>
							</div>
						{/each}
					{/if}
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</div>
