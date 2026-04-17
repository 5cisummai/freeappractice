<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import SiteFooter from '$lib/components/site-footer.svelte';
	import Topbar from '$lib/components/topbar.svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Skeleton from '$lib/components/ui/skeleton/index.js';

	interface GenerationStats {
		byApClass: Record<string, number>;
		byUnit: Record<string, number>;
		totals: {
			questions: number;
			totalQuestionChars: number;
		};
	}

	let generationStats = $state<GenerationStats | null>(null);
	let loading = $state(true);

	onMount(async () => {
		try {
			const res = await fetch('/api/question/generation-stats');
			if (res.ok) {
				const data = await res.json();
				generationStats = data.stats ?? null;
			}
		} catch (e) {
			console.error('Failed to load stats', e);
		} finally {
			loading = false;
		}
	});

	const classTableData = $derived.by(() => {
		if (!generationStats?.byApClass || !generationStats?.totals.questions) return [];
		const total = generationStats.totals.questions;
		return Object.entries(generationStats.byApClass)
			.map(([subject, count]) => ({
				subject,
				count,
				percentage: Math.round((count / total) * 100)
			}))
			.sort((a, b) => b.count - a.count);
	});

	const unitTableData = $derived.by(() => {
		if (!generationStats?.byUnit) return [];
		return Object.entries(generationStats.byUnit)
			.map(([unit, count]) => ({ unit, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 30);
	});

	const totalGenerated = $derived(generationStats?.totals.questions ?? 0);
	const totalChars = $derived(generationStats?.totals.totalQuestionChars ?? 0);
	const apClassesCount = $derived(Object.keys(generationStats?.byApClass ?? {}).length);
	const unitsCount = $derived(Object.keys(generationStats?.byUnit ?? {}).length);
</script>

<svelte:head>
	<title>Stats – Free AP Practice</title>
</svelte:head>

<div class="flex min-h-screen flex-col bg-background text-foreground">
	<Topbar />

	<main class="flex-1 py-12">
		<div class="mx-auto w-full max-w-6xl space-y-10 px-5 sm:px-8">
			<a
				href={resolve('/')}
				class="inline-block text-sm text-muted-foreground hover:text-foreground">← Back to Home</a
			>

			<div class="space-y-2">
				<h1 class="text-4xl font-semibold tracking-tight">Question Generation Stats</h1>
				<p class="text-sm text-muted-foreground">
					Real-time data on questions generated per AP class and unit
				</p>
			</div>

			{#if loading}
				<!-- Overview Cards Skeleton -->
				<section>
					<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						<Card.Root class="p-5">
							<Skeleton.Root class="mb-2 h-4 w-24" />
							<Skeleton.Root class="h-8 w-32" />
						</Card.Root>
						<Card.Root class="p-5">
							<Skeleton.Root class="mb-2 h-4 w-28" />
							<Skeleton.Root class="h-8 w-20" />
						</Card.Root>
						<Card.Root class="p-5">
							<Skeleton.Root class="mb-2 h-4 w-20" />
							<Skeleton.Root class="h-8 w-16" />
						</Card.Root>
						<Card.Root class="p-5">
							<Skeleton.Root class="mb-2 h-4 w-24" />
							<Skeleton.Root class="h-8 w-16" />
						</Card.Root>
					</div>
				</section>

				<!-- By AP Class Skeleton -->
				<section>
					<h2 class="mb-4 text-2xl font-semibold">Questions by AP Class</h2>
					<Card.Root>
						<div class="space-y-3 p-4">
							<!-- eslint-disable-next-line svelte/require-each-key -->
							{#each Array(8) as _}
								<div class="flex items-center gap-4">
									<Skeleton.Root class="h-4 w-32" />
									<Skeleton.Root class="h-4 w-16" />
									<Skeleton.Root class="h-2 flex-1" />
									<Skeleton.Root class="h-4 w-12" />
								</div>
							{/each}
						</div>
					</Card.Root>
				</section>

				<!-- By Unit Skeleton -->
				<section>
					<h2 class="mb-4 text-2xl font-semibold">Top Units (All Classes)</h2>
					<Card.Root>
						<div class="space-y-3 p-4">
							<!-- eslint-disable-next-line svelte/require-each-key -->
							{#each Array(10) as _}
								<div class="flex items-center gap-4">
									<Skeleton.Root class="h-4 flex-1" />
									<Skeleton.Root class="h-4 w-20" />
								</div>
							{/each}
						</div>
					</Card.Root>
				</section>
			{:else}
				<!-- Overview Cards -->
				<section>
					<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						<Card.Root class="p-5">
							<div class="text-sm text-muted-foreground">Total Questions</div>
							<div class="text-3xl font-bold">{totalGenerated.toLocaleString()}</div>
						</Card.Root>
						<Card.Root class="p-5">
							<div class="text-sm text-muted-foreground">Total Characters</div>
							<div class="text-3xl font-bold">{(totalChars / 1000).toFixed(1)}K</div>
						</Card.Root>
						<Card.Root class="p-5">
							<div class="text-sm text-muted-foreground">AP Classes</div>
							<div class="text-3xl font-bold">{apClassesCount}</div>
						</Card.Root>
						<Card.Root class="p-5">
							<div class="text-sm text-muted-foreground">Unique Units</div>
							<div class="text-3xl font-bold">{unitsCount}</div>
						</Card.Root>
					</div>
				</section>

				<!-- By AP Class -->
				<section>
					<h2 class="mb-4 text-2xl font-semibold">Questions by AP Class</h2>
					<Card.Root>
						<div class="overflow-x-auto">
							<Table.Root>
								<Table.Header>
									<Table.Row>
										<Table.Head>AP Class</Table.Head>
										<Table.Head class="text-right">Questions</Table.Head>
										<Table.Head class="text-right">%</Table.Head>
										<Table.Head class="w-full">Distribution</Table.Head>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{#each classTableData as row (row.subject)}
										<Table.Row>
											<Table.Cell class="font-medium">{row.subject}</Table.Cell>
											<Table.Cell class="text-right">{row.count.toLocaleString()}</Table.Cell>
											<Table.Cell class="text-right">{row.percentage}%</Table.Cell>
											<Table.Cell>
												<div class="h-2 w-full overflow-hidden rounded-full bg-muted">
													<div
														class="h-full rounded-full bg-primary"
														style="width: {row.percentage}%"
													></div>
												</div>
											</Table.Cell>
										</Table.Row>
									{/each}
								</Table.Body>
							</Table.Root>
						</div>
					</Card.Root>
				</section>

				<!-- By Unit (Global) -->
				<section>
					<h2 class="mb-4 text-2xl font-semibold">Top Units (All Classes)</h2>
					<Card.Root>
						<div class="overflow-x-auto">
							<Table.Root>
								<Table.Header>
									<Table.Row>
										<Table.Head>Unit</Table.Head>
										<Table.Head class="text-right">Questions</Table.Head>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{#each unitTableData as row (row.unit)}
										<Table.Row>
											<Table.Cell class="font-medium">{row.unit}</Table.Cell>
											<Table.Cell class="text-right">{row.count.toLocaleString()}</Table.Cell>
										</Table.Row>
									{/each}
								</Table.Body>
							</Table.Root>
						</div>
					</Card.Root>
				</section>
			{/if}
		</div>
	</main>

	<SiteFooter />
</div>
