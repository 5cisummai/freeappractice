<script lang="ts">
	import UsersIcon from '@lucide/svelte/icons/users';
	import DatabaseZapIcon from '@lucide/svelte/icons/database-zap';
	import BadgeCheckIcon from '@lucide/svelte/icons/badge-check';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import MessageSquareIcon from '@lucide/svelte/icons/message-square';
	import PageShell from '$lib/components/layout/page-shell.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import AdminUsersDataTable from '$lib/components/admin/admin-users-data-table.svelte';
	import AdminCacheDashboard from '$lib/components/admin/admin-cache-dashboard.svelte';
	import AdminQualityDashboard from '$lib/components/admin/admin-quality-dashboard.svelte';
	import AdminSuperDashboard from '$lib/components/admin/admin-super-dashboard.svelte';
	import AdminFeedbackDashboard from '$lib/components/admin/admin-feedback-dashboard.svelte';
	import type { AdminTab } from '$lib/admin/types.js';
	import { resolve } from '$app/paths';

	let { data } = $props();

	const tabItems: Array<{ value: AdminTab; label: string; icon: typeof UsersIcon }> = [
		{ value: 'users', label: 'Users', icon: UsersIcon },
		{ value: 'cache', label: 'Pool', icon: DatabaseZapIcon },
		{ value: 'quality', label: 'Quality', icon: BadgeCheckIcon },
		{ value: 'super', label: 'Super', icon: SparklesIcon },
		{ value: 'feedback', label: 'Feedback', icon: MessageSquareIcon }
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
	<title>Admin | Free AP Practice</title>
</svelte:head>

<PageShell title="Admin">
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

		{#if data.activeTab === 'users'}
			<AdminUsersDataTable
				data={data.users}
				total={data.totalUsers}
				page={Math.floor(data.offset / data.limit) + 1}
				pageSize={data.limit}
				search={data.search}
				errorMessage={data.errorMessage}
			/>
		{:else if data.activeTab === 'cache'}
			<AdminCacheDashboard buckets={data.cacheBuckets} />
		{:else if data.activeTab === 'quality'}
			<AdminQualityDashboard snapshot={data.quality} />
		{:else if data.activeTab === 'super'}
			<AdminSuperDashboard overview={data.superOverview} errorMessage={data.errorMessage} />
		{:else if data.activeTab === 'feedback'}
			<AdminFeedbackDashboard
				items={data.feedback}
				total={data.totalFeedback}
				totalSidebar={data.totalSidebarFeedback}
				totalBugReports={data.totalBugReports}
				errorMessage={data.errorMessage}
			/>
		{/if}
	</div>
</PageShell>
