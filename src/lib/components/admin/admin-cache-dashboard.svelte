<script lang="ts">
	import SearchIcon from '@tabler/icons-svelte/icons/search';
	import type {
		CacheBucketSummary,
		PoolQuestionType,
		PoolRefillStatusUi
	} from '$lib/admin/types.js';
	import AdminCacheBucketActions from '$lib/components/admin/admin-cache-bucket-actions.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import {
		POOL_RETIRE_OLDEST_PERCENT,
		poolRetireQuantityForBucket
	} from '$lib/question-bank/pool-constants';

	type Props = {
		buckets: CacheBucketSummary[];
	};

	type PoolSnapshot = {
		buckets: CacheBucketSummary[];
	};

	let { buckets }: Props = $props();

	let localBuckets = $state<CacheBucketSummary[] | null>(null);
	let busyAction = $state<string | null>(null);
	let statusMessage = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);
	let retireOldestOpen = $state(false);
	let typeFilter = $state<PoolQuestionType>('mcq');
	let search = $state('');

	const liveBuckets = $derived(localBuckets ?? buckets);
	const normalizedSearch = $derived(search.trim().toLowerCase());
	const visibleBuckets = $derived(
		liveBuckets.filter((bucket) => {
			if (bucket.questionType !== typeFilter) return false;
			if (!normalizedSearch) return true;
			return `${bucket.apClass} ${bucket.unit}`.toLowerCase().includes(normalizedSearch);
		})
	);
	const retireOldestPreviewCount = $derived(
		liveBuckets.reduce(
			(sum, bucket) => sum + poolRetireQuantityForBucket(bucket.activeCount),
			0
		)
	);
	const retireOldestPreviewBuckets = $derived(
		liveBuckets.filter((bucket) => poolRetireQuantityForBucket(bucket.activeCount) >= 1).length
	);

	function bucketKey(bucket: CacheBucketSummary): string {
		return `${bucket.questionType}:${bucket.apClass}:${bucket.unit}`;
	}

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
			localBuckets = snapshot.buckets;
			statusMessage = 'Inventory refreshed.';
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Unable to refresh inventory.';
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
			localBuckets = snapshot.buckets;
			statusMessage = `Enqueued ${result.enqueued} deficit bucket(s) for async refill.`;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Unable to enqueue deficits.';
		} finally {
			busyAction = null;
		}
	}

	async function retireOldestPercent(): Promise<void> {
		busyAction = 'retire-oldest';
		statusMessage = null;
		errorMessage = null;
		try {
			const result = await request<{
				retired: number;
				bucketsAffected: number;
				enqueued: number;
			}>({
				action: 'retireOldestPercent',
				percent: POOL_RETIRE_OLDEST_PERCENT
			});
			const snapshot = await request<PoolSnapshot>({ action: 'refresh' });
			localBuckets = snapshot.buckets;
			statusMessage = result.retired
				? `Retired ${result.retired.toLocaleString()} oldest question(s) across ${result.bucketsAffected.toLocaleString()} bucket(s); ${result.enqueued.toLocaleString()} refill job(s) queued.`
				: 'No active questions met the 30% retirement threshold.';
			retireOldestOpen = false;
		} catch (error) {
			errorMessage =
				error instanceof Error ? error.message : 'Unable to retire oldest pool questions.';
		} finally {
			busyAction = null;
		}
	}

	async function retireBucket(bucket: CacheBucketSummary, quantity: number): Promise<void> {
		const key = `retire:${bucketKey(bucket)}`;
		busyAction = key;
		statusMessage = null;
		errorMessage = null;
		try {
			const result = await request<{ retired: number }>({
				action: 'retireBucket',
				questionType: bucket.questionType,
				apClass: bucket.apClass,
				unit: bucket.unit,
				quantity
			});
			const snapshot = await request<PoolSnapshot>({ action: 'refresh' });
			localBuckets = snapshot.buckets;
			statusMessage = result.retired
				? `Deleted ${result.retired} ${bucket.questionType.toUpperCase()} question(s) from ${bucket.apClass} · ${bucket.unit}; refill queued.`
				: `No active ${bucket.questionType.toUpperCase()} questions were available in ${bucket.apClass} · ${bucket.unit}.`;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Unable to delete questions.';
		} finally {
			busyAction = null;
		}
	}

	function isBusy(action: string): boolean {
		return busyAction === action;
	}
</script>

<div class="space-y-5">
	<div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
		<div class="space-y-1">
			<p class="text-sm font-medium">Question inventory</p>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<div class="relative w-full sm:w-64">
				<SearchIcon
					class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
				/>
				<label class="sr-only" for="admin-pool-search">Search inventory</label>
				<input
					id="admin-pool-search"
					bind:value={search}
					placeholder="Search class or unit"
					class="h-9 w-full rounded-md border border-input bg-background pr-3 pl-9 text-sm shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
				/>
			</div>
			<div
				class="flex rounded-lg border border-border/70 p-1"
				role="group"
				aria-label="Question type"
			>
				<Button
					size="sm"
					variant={typeFilter === 'mcq' ? 'default' : 'ghost'}
					aria-pressed={typeFilter === 'mcq'}
					onclick={() => (typeFilter = 'mcq')}
				>
					MCQ
				</Button>
				<Button
					size="sm"
					variant={typeFilter === 'frq' ? 'default' : 'ghost'}
					aria-pressed={typeFilter === 'frq'}
					onclick={() => (typeFilter = 'frq')}
				>
					FRQ
				</Button>
			</div>
			<Button variant="outline" onclick={() => void refreshSnapshot()} disabled={!!busyAction}>
				{isBusy('refresh') ? 'Refreshing…' : 'Refresh'}
			</Button>
			<Button onclick={() => void enqueueAllDeficits()} disabled={!!busyAction}>
				{isBusy('enqueue-all') ? 'Enqueueing…' : 'Enqueue all deficits'}
			</Button>
			<Button
				variant="destructive"
				onclick={() => (retireOldestOpen = true)}
				disabled={!!busyAction || retireOldestPreviewCount < 1}
			>
				Retire {POOL_RETIRE_OLDEST_PERCENT}% oldest
			</Button>
		</div>
	</div>

	<AlertDialog.Root bind:open={retireOldestOpen}>
		<AlertDialog.Content>
			<AlertDialog.Header>
				<AlertDialog.Title>
					Retire {POOL_RETIRE_OLDEST_PERCENT}% of the oldest pool questions?
				</AlertDialog.Title>
				<AlertDialog.Description>
					This retires about {retireOldestPreviewCount.toLocaleString()} active question{retireOldestPreviewCount ===
					1
						? ''
						: 's'} across {retireOldestPreviewBuckets.toLocaleString()} bucket{retireOldestPreviewBuckets ===
					1
						? ''
						: 's'}, starting with the oldest in each class/unit. Retired questions stop appearing in
					practice, but history and bookmarks still resolve. Refill jobs are queued for every affected
					bucket.
				</AlertDialog.Description>
			</AlertDialog.Header>
			<AlertDialog.Footer>
				<AlertDialog.Cancel disabled={isBusy('retire-oldest')}>Cancel</AlertDialog.Cancel>
				<AlertDialog.Action
					class="text-destructive-foreground bg-destructive hover:bg-destructive/90"
					disabled={isBusy('retire-oldest') || retireOldestPreviewCount < 1}
					onclick={() => void retireOldestPercent()}
				>
					{isBusy('retire-oldest') ? 'Retiring…' : 'Retire and queue refills'}
				</AlertDialog.Action>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>

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

	<div class="rounded-xl border border-border/70 bg-background">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Class</Table.Head>
					<Table.Head>Unit</Table.Head>
					<Table.Head>Filled / quota</Table.Head>
					<Table.Head>Status</Table.Head>
					<Table.Head>Last refill</Table.Head>
					<Table.Head>Est. fill</Table.Head>
					<Table.Head class="w-12 text-right"><span class="sr-only">Actions</span></Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each visibleBuckets as bucket (bucketKey(bucket))}
					<Table.Row>
						<Table.Cell class="font-medium">{bucket.apClass}</Table.Cell>
						<Table.Cell class="max-w-52 truncate" title={bucket.unit}>{bucket.unit}</Table.Cell>
						<Table.Cell>
							<div class="min-w-36 space-y-1.5">
								<div class="flex items-center justify-between gap-3 text-xs tabular-nums">
									<span
										>{bucket.activeCount.toLocaleString()} / {bucket.target.toLocaleString()}</span
									>
									<span class="text-muted-foreground">{bucket.fillRatio}%</span>
								</div>
								<div class="h-1.5 overflow-hidden rounded-full bg-muted">
									<div
										class={bucket.health === 'healthy'
											? 'h-full rounded-full bg-emerald-500'
											: bucket.health === 'low'
												? 'h-full rounded-full bg-amber-500'
												: 'h-full rounded-full bg-destructive'}
										style={`width:${bucket.fillRatio}%`}
									></div>
								</div>
							</div>
						</Table.Cell>
						<Table.Cell>
							<div class="flex flex-wrap gap-1.5">
								<span
									class={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${healthClasses(bucket.health)}`}
								>
									{bucket.health}
								</span>
								<span
									class={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${refillClasses(bucket.refillStatus)}`}
								>
									{bucket.refillStatus}
								</span>
							</div>
							{#if bucket.lastError}
								<p class="mt-1 max-w-48 truncate text-xs text-destructive" title={bucket.lastError}>
									{bucket.lastError}
								</p>
							{/if}
						</Table.Cell>
						<Table.Cell class="text-xs text-muted-foreground">
							{formatRelativeDate(bucket.lastSuccessAt)}
						</Table.Cell>
						<Table.Cell class="text-xs text-muted-foreground">
							{formatUsd(bucket.estimatedRemainingCostUsd)}
						</Table.Cell>
						<Table.Cell class="text-right">
							<AdminCacheBucketActions
								{bucket}
								disabled={!!busyAction}
								busy={isBusy(`retire:${bucketKey(bucket)}`)}
								onRetire={(quantity) => retireBucket(bucket, quantity)}
							/>
						</Table.Cell>
					</Table.Row>
				{:else}
					<Table.Row>
						<Table.Cell colspan={7} class="h-24 text-center text-muted-foreground">
							No {typeFilter.toUpperCase()} inventory buckets found{normalizedSearch
								? ` for “${search.trim()}”`
								: ''}.
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>
</div>
