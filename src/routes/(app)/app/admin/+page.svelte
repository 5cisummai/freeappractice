<script lang="ts">
	import UsersIcon from '@lucide/svelte/icons/users';
	import DatabaseZapIcon from '@lucide/svelte/icons/database-zap';
	import ChartColumnBigIcon from '@lucide/svelte/icons/chart-column-big';
	import LayoutDashboardIcon from '@lucide/svelte/icons/layout-dashboard';
	import PageShell from '$lib/components/page-shell.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import AdminUsersDataTable from '$lib/components/admin/admin-users-data-table.svelte';
	import AdminCacheDashboard from '$lib/components/admin/admin-cache-dashboard.svelte';
	import type { AdminTab } from '$lib/admin/types.js';
	import { resolve } from '$app/paths';

	let { data } = $props();

	const tabItems: Array<{ value: AdminTab; label: string; icon: typeof LayoutDashboardIcon }> = [
		{ value: 'overview', label: 'Overview', icon: LayoutDashboardIcon },
		{ value: 'users', label: 'Users', icon: UsersIcon },
		{ value: 'cache', label: 'Cache', icon: DatabaseZapIcon },
		{ value: 'generation', label: 'Generation', icon: ChartColumnBigIcon }
	];

	function tabHref(tab: AdminTab): string {
		const params = [`tab=${tab}`];
		if (tab === 'users' && data.search) params.push(`search=${encodeURIComponent(data.search)}`);
		const currentPage = Math.floor(data.offset / data.limit) + 1;
		if (tab === 'users' && currentPage > 1) params.push(`page=${currentPage}`);
		return `${resolve('/app/admin')}?${params.join('&')}`;
	}
</script>

<svelte:head>
	<title>Admin - Free AP Practice</title>
</svelte:head>

<PageShell
	title="Admin"
	description="User management, question cache health, and generation visibility."
>
	<div class="space-y-6">
		<div class="flex flex-wrap gap-2 border-b border-border/70 pb-3">
			{#each tabItems as item (item.value)}
				<Button
					href={tabHref(item.value)}
					variant={data.activeTab === item.value ? 'default' : 'ghost'}
					class="rounded-full"
					aria-current={data.activeTab === item.value ? 'page' : undefined}
				>
					<item.icon />
					<span>{item.label}</span>
				</Button>
			{/each}
		</div>

		{#if data.activeTab === 'overview'}
			<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
				<Card.Root class="rounded-2xl border border-border/60 p-5 shadow-sm">
					<p class="text-sm text-muted-foreground">Registered users</p>
					<p class="mt-2 text-3xl font-semibold tracking-tight">{data.totalUsers}</p>
				</Card.Root>
				<Card.Root class="rounded-2xl border border-border/60 p-5 shadow-sm">
					<p class="text-sm text-muted-foreground">Learner profiles</p>
					<p class="mt-2 text-3xl font-semibold tracking-tight">{data.totalUserProfiles}</p>
				</Card.Root>
				<Card.Root class="rounded-2xl border border-border/60 p-5 shadow-sm">
					<p class="text-sm text-muted-foreground">Cached questions</p>
					<p class="mt-2 text-3xl font-semibold tracking-tight">
						{data.cacheOverview.totalQuestions}
					</p>
				</Card.Root>
				<Card.Root class="rounded-2xl border border-border/60 p-5 shadow-sm">
					<p class="text-sm text-muted-foreground">Buckets below target</p>
					<p class="mt-2 text-3xl font-semibold tracking-tight">
						{data.cacheOverview.underTargetBuckets}
					</p>
				</Card.Root>
				<Card.Root class="rounded-2xl border border-border/60 p-5 shadow-sm">
					<p class="text-sm text-muted-foreground">Generated questions</p>
					<p class="mt-2 text-3xl font-semibold tracking-tight">
						{data.generationOverview.totalQuestions}
					</p>
				</Card.Root>
			</div>

			<div class="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
				<Card.Root class="rounded-2xl border border-border/60 shadow-sm">
					<Card.Header class="border-b border-border/70">
						<Card.Title>Needs attention</Card.Title>
						<Card.Description
							>Fast read on where the system is thin or actively working.</Card.Description
						>
					</Card.Header>
					<Card.Content class="space-y-3 p-6">
						<div class="rounded-xl border border-border/60 p-4">
							<p class="text-sm font-medium">Cache pressure</p>
							<p class="mt-1 text-sm text-muted-foreground">
								{data.cacheOverview.emptyBuckets} empty bucket(s), {data.cacheOverview
									.underTargetBuckets}
								below the target pool size of {data.cacheOverview.targetPoolSize}.
							</p>
						</div>
						<div class="rounded-xl border border-border/60 p-4">
							<p class="text-sm font-medium">Worker activity</p>
							<p class="mt-1 text-sm text-muted-foreground">
								{data.cacheOverview.activeMissLocks} active miss lock(s) across serverless instances.
							</p>
						</div>
						<div class="rounded-xl border border-border/60 p-4">
							<p class="text-sm font-medium">Reusable inventory</p>
							<p class="mt-1 text-sm text-muted-foreground">
								{data.cacheOverview.totalQuestions} cached question(s) can be shared across sessions,
								filtered only by each browser's seen list.
							</p>
						</div>
					</Card.Content>
				</Card.Root>

				<Card.Root class="rounded-2xl border border-border/60 shadow-sm">
					<Card.Header class="border-b border-border/70">
						<Card.Title>Top generation volume</Card.Title>
						<Card.Description>AP classes producing the most saved questions.</Card.Description>
					</Card.Header>
					<Card.Content class="space-y-3 p-6">
						{#each data.generationByClass.slice(0, 6) as row (row.apClass)}
							<div class="space-y-2">
								<div class="flex items-center justify-between gap-3">
									<p class="font-medium">{row.apClass}</p>
									<p class="text-sm text-muted-foreground">{row.count}</p>
								</div>
								<div class="h-2 overflow-hidden rounded-full bg-muted">
									<div class="h-full rounded-full bg-primary" style={`width:${row.share}%`}></div>
								</div>
							</div>
						{/each}
					</Card.Content>
				</Card.Root>
			</div>
		{:else if data.activeTab === 'users'}
			<AdminUsersDataTable
				data={data.users}
				total={data.totalUsers}
				page={Math.floor(data.offset / data.limit) + 1}
				pageSize={data.limit}
				search={data.search}
				errorMessage={data.errorMessage}
			/>
		{:else if data.activeTab === 'cache'}
			<AdminCacheDashboard
				overview={data.cacheOverview}
				buckets={data.cacheBuckets}
				locks={data.cacheLocks}
				recentTopics={data.recentTopics}
			/>
		{:else if data.activeTab === 'generation'}
			<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				<Card.Root class="rounded-2xl border border-border/60 p-5 shadow-sm">
					<p class="text-sm text-muted-foreground">Total generated</p>
					<p class="mt-2 text-3xl font-semibold tracking-tight">
						{data.generationOverview.totalQuestions}
					</p>
				</Card.Root>
				<Card.Root class="rounded-2xl border border-border/60 p-5 shadow-sm">
					<p class="text-sm text-muted-foreground">Question characters</p>
					<p class="mt-2 text-3xl font-semibold tracking-tight">
						{(data.generationOverview.totalQuestionChars / 1000).toFixed(1)}K
					</p>
				</Card.Root>
				<Card.Root class="rounded-2xl border border-border/60 p-5 shadow-sm">
					<p class="text-sm text-muted-foreground">AP classes</p>
					<p class="mt-2 text-3xl font-semibold tracking-tight">
						{data.generationOverview.apClassesCount}
					</p>
				</Card.Root>
				<Card.Root class="rounded-2xl border border-border/60 p-5 shadow-sm">
					<p class="text-sm text-muted-foreground">Unique units</p>
					<p class="mt-2 text-3xl font-semibold tracking-tight">
						{data.generationOverview.unitsCount}
					</p>
				</Card.Root>
			</div>

			<div class="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
				<Card.Root class="rounded-2xl border border-border/60 shadow-sm">
					<Card.Header class="border-b border-border/70">
						<Card.Title>Questions by AP class</Card.Title>
						<Card.Description>Relative generation volume by subject.</Card.Description>
					</Card.Header>
					<Card.Content class="p-0">
						<Table.Root>
							<Table.Header>
								<Table.Row>
									<Table.Head>AP class</Table.Head>
									<Table.Head class="text-right">Questions</Table.Head>
									<Table.Head class="text-right">Share</Table.Head>
									<Table.Head>Distribution</Table.Head>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{#each data.generationByClass as row (row.apClass)}
									<Table.Row>
										<Table.Cell class="font-medium">{row.apClass}</Table.Cell>
										<Table.Cell class="text-right">{row.count}</Table.Cell>
										<Table.Cell class="text-right">{row.share}%</Table.Cell>
										<Table.Cell>
											<div class="h-2 overflow-hidden rounded-full bg-muted">
												<div
													class="h-full rounded-full bg-primary"
													style={`width:${row.share}%`}
												></div>
											</div>
										</Table.Cell>
									</Table.Row>
								{/each}
							</Table.Body>
						</Table.Root>
					</Card.Content>
				</Card.Root>

				<Card.Root class="rounded-2xl border border-border/60 shadow-sm">
					<Card.Header class="border-b border-border/70">
						<Card.Title>Most generated units</Card.Title>
						<Card.Description>Top course and unit combinations written to cache.</Card.Description>
					</Card.Header>
					<Card.Content class="p-0">
						<Table.Root>
							<Table.Header>
								<Table.Row>
									<Table.Head>Class</Table.Head>
									<Table.Head>Unit</Table.Head>
									<Table.Head class="text-right">Questions</Table.Head>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{#each data.topGeneratedUnits as row (`${row.apClass}-${row.unit}`)}
									<Table.Row>
										<Table.Cell class="font-medium">{row.apClass}</Table.Cell>
										<Table.Cell>{row.unit}</Table.Cell>
										<Table.Cell class="text-right">{row.count}</Table.Cell>
									</Table.Row>
								{/each}
							</Table.Body>
						</Table.Root>
					</Card.Content>
				</Card.Root>
			</div>
		{/if}
	</div>
</PageShell>
