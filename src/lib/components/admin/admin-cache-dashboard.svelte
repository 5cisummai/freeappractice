<script lang="ts">
	import type {
		CacheBucketSummary,
		CacheLockSnapshot,
		CacheOverview,
		RecentTopicSnapshot
	} from '$lib/admin/types.js';
	import * as Card from '$lib/components/ui/card/index.js';

	type Props = {
		overview: CacheOverview;
		buckets: CacheBucketSummary[];
		locks: CacheLockSnapshot[];
		recentTopics: RecentTopicSnapshot[];
	};

	let { overview, buckets, locks, recentTopics }: Props = $props();

	const statusSegments = $derived([
		{
			label: 'Available',
			value: overview.available,
			width: overview.totalQuestions ? (overview.available / overview.totalQuestions) * 100 : 0,
			barClass: 'bg-emerald-500'
		},
		{
			label: 'Serving',
			value: overview.serving,
			width: overview.totalQuestions ? (overview.serving / overview.totalQuestions) * 100 : 0,
			barClass: 'bg-sky-500'
		},
		{
			label: 'Generating',
			value: overview.generating,
			width: overview.totalQuestions ? (overview.generating / overview.totalQuestions) * 100 : 0,
			barClass: 'bg-amber-500'
		},
		{
			label: 'Retired',
			value: overview.retired,
			width: overview.totalQuestions ? (overview.retired / overview.totalQuestions) * 100 : 0,
			barClass: 'bg-zinc-400'
		}
	]);

	function healthClasses(health: CacheBucketSummary['health']): string {
		if (health === 'healthy')
			return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
		if (health === 'low')
			return 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300';
		return 'border-destructive/20 bg-destructive/10 text-destructive';
	}

	function lockClasses(type: CacheLockSnapshot['type']): string {
		if (type === 'replenish')
			return 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300';
		if (type === 'miss')
			return 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300';
		return 'border-border bg-muted text-muted-foreground';
	}

	function formatRelativeDate(value: Date | string): string {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '-';
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		}).format(date);
	}
</script>

<div class="space-y-6">
	<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
		<Card.Root class="rounded-2xl border border-border/60 p-4 shadow-sm">
			<p class="text-sm text-muted-foreground">Cached questions</p>
			<p class="mt-2 text-3xl font-semibold tracking-tight">{overview.totalQuestions}</p>
		</Card.Root>
		<Card.Root class="rounded-2xl border border-border/60 p-4 shadow-sm">
			<p class="text-sm text-muted-foreground">Available now</p>
			<p class="mt-2 text-3xl font-semibold tracking-tight">{overview.available}</p>
			<p class="mt-1 text-xs text-muted-foreground">
				{overview.availableRatio}% immediately serveable
			</p>
		</Card.Root>
		<Card.Root class="rounded-2xl border border-border/60 p-4 shadow-sm">
			<p class="text-sm text-muted-foreground">Tracked buckets</p>
			<p class="mt-2 text-3xl font-semibold tracking-tight">{overview.totalBuckets}</p>
		</Card.Root>
		<Card.Root class="rounded-2xl border border-border/60 p-4 shadow-sm">
			<p class="text-sm text-muted-foreground">Below target</p>
			<p class="mt-2 text-3xl font-semibold tracking-tight">{overview.underTargetBuckets}</p>
			<p class="mt-1 text-xs text-muted-foreground">Target size {overview.targetPoolSize}</p>
		</Card.Root>
		<Card.Root class="rounded-2xl border border-border/60 p-4 shadow-sm">
			<p class="text-sm text-muted-foreground">Empty buckets</p>
			<p class="mt-2 text-3xl font-semibold tracking-tight">{overview.emptyBuckets}</p>
		</Card.Root>
		<Card.Root class="rounded-2xl border border-border/60 p-4 shadow-sm">
			<p class="text-sm text-muted-foreground">Active locks</p>
			<p class="mt-2 text-3xl font-semibold tracking-tight">{overview.activeLocks}</p>
			<p class="mt-1 text-xs text-muted-foreground">
				{overview.activeMissLocks} miss · {overview.activeReplenishLocks} replenish
			</p>
		</Card.Root>
	</div>

	<div class="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
		<Card.Root class="rounded-2xl border border-border/60 shadow-sm">
			<Card.Header class="border-b border-border/70">
				<Card.Title>Cache status mix</Card.Title>
				<Card.Description>Question inventory by live pool state.</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4 p-6">
				<div class="h-3 overflow-hidden rounded-full bg-muted">
					<div class="flex h-full w-full">
						{#each statusSegments as segment (segment.label)}
							<div class={segment.barClass} style={`width:${segment.width}%`}></div>
						{/each}
					</div>
				</div>
				<div class="grid gap-3 sm:grid-cols-2">
					{#each statusSegments as segment (segment.label)}
						<div class="rounded-xl border border-border/60 px-4 py-3">
							<p class="text-xs tracking-[0.08em] text-muted-foreground uppercase">
								{segment.label}
							</p>
							<p class="mt-2 text-2xl font-semibold tracking-tight">{segment.value}</p>
						</div>
					{/each}
				</div>
				<div class="grid gap-3 sm:grid-cols-3">
					<div class="rounded-xl border border-border/60 px-4 py-3">
						<p class="text-xs tracking-[0.08em] text-muted-foreground uppercase">Served 24h</p>
						<p class="mt-2 text-2xl font-semibold tracking-tight">{overview.servedLast24h}</p>
					</div>
					<div class="rounded-xl border border-border/60 px-4 py-3">
						<p class="text-xs tracking-[0.08em] text-muted-foreground uppercase">Healthy buckets</p>
						<p class="mt-2 text-2xl font-semibold tracking-tight">{overview.healthyBuckets}</p>
					</div>
					<div class="rounded-xl border border-border/60 px-4 py-3">
						<p class="text-xs tracking-[0.08em] text-muted-foreground uppercase">Target size</p>
						<p class="mt-2 text-2xl font-semibold tracking-tight">{overview.targetPoolSize}</p>
					</div>
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root class="rounded-2xl border border-border/60 shadow-sm">
			<Card.Header class="border-b border-border/70">
				<Card.Title>Active locks</Card.Title>
				<Card.Description>Current miss coalescing and replenish workers.</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-3 p-6">
				{#if locks.length === 0}
					<p class="text-sm text-muted-foreground">No active cache locks.</p>
				{:else}
					{#each locks as lock (lock.key)}
						<div class="rounded-xl border border-border/60 p-4">
							<div class="flex items-start justify-between gap-3">
								<div class="min-w-0">
									<p class="font-medium">{lock.apClass}</p>
									<p class="text-sm text-muted-foreground">{lock.unit}</p>
								</div>
								<span
									class={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${lockClasses(lock.type)}`}
								>
									{lock.type}
								</span>
							</div>
							<p class="mt-2 truncate text-xs text-muted-foreground">{lock.key}</p>
							<p class="mt-1 text-xs text-muted-foreground">
								Expires {formatRelativeDate(lock.expiresAt)}
							</p>
						</div>
					{/each}
				{/if}
			</Card.Content>
		</Card.Root>
	</div>

	<div class="grid gap-6 xl:grid-cols-[1.3fr_0.95fr]">
		<Card.Root class="rounded-2xl border border-border/60 shadow-sm">
			<Card.Header class="border-b border-border/70">
				<Card.Title>Bucket health</Card.Title>
				<Card.Description>Which class and unit pools need refill attention first.</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-3 p-6">
				{#each buckets.slice(0, 12) as bucket (`${bucket.apClass}-${bucket.unit}`)}
					<div class="rounded-xl border border-border/60 p-4">
						<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
							<div class="min-w-0">
								<p class="font-medium">{bucket.apClass}</p>
								<p class="text-sm text-muted-foreground">{bucket.unit}</p>
							</div>
							<span
								class={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${healthClasses(bucket.health)}`}
							>
								{bucket.health}
							</span>
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
							<div class="grid gap-2 text-xs text-muted-foreground sm:grid-cols-4">
								<span>{bucket.available} available</span>
								<span>{bucket.serving} serving</span>
								<span>{bucket.total}/{overview.targetPoolSize} pooled</span>
								<span>{bucket.servedLast24h} served 24h</span>
							</div>
						</div>
					</div>
				{/each}
			</Card.Content>
		</Card.Root>

		<Card.Root class="rounded-2xl border border-border/60 shadow-sm">
			<Card.Header class="border-b border-border/70">
				<Card.Title>Recent topic churn</Card.Title>
				<Card.Description>Latest topics generated into the hot pool.</Card.Description>
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
