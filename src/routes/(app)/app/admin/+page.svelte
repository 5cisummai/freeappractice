<script lang="ts">
	import { resolve } from '$app/paths';
	import PageShell from '$lib/components/page-shell.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import SearchIcon from '@lucide/svelte/icons/search';

	type AdminUser = {
		id: string;
		name?: string | null;
		email?: string | null;
		role?: string | string[] | null;
		banned?: boolean | null;
		createdAt?: Date | string | null;
		updatedAt?: Date | string | null;
	};

	let { data } = $props();

	const users = $derived(data.users as AdminUser[]);
	const limit = $derived(data.limit || 25);
	const offset = $derived(data.offset || 0);
	const currentPage = $derived(Math.floor(offset / limit) + 1);
	const totalPages = $derived(Math.max(Math.ceil(data.total / limit), 1));
	const previousHref = $derived(getPageHref(Math.max(currentPage - 1, 1)));
	const nextHref = $derived(getPageHref(Math.min(currentPage + 1, totalPages)));

	function getPageHref(page: number): string {
		const params = [];
		if (data.search) params.push(`search=${encodeURIComponent(data.search)}`);
		if (page > 1) params.push(`page=${page}`);
		const query = params.join('&');
		return `${resolve('/app/admin')}${query ? `?${query}` : ''}`;
	}

	function formatRoles(role: AdminUser['role']): string {
		if (Array.isArray(role)) return role.join(', ');
		return role || 'user';
	}

	function formatDate(value: AdminUser['createdAt']): string {
		if (!value) return '-';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '-';
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		}).format(date);
	}
</script>

<svelte:head>
	<title>Admin - Free AP Practice</title>
</svelte:head>

<PageShell title="Admin" description="Manage the Free AP Practice user base.">
	<Card.Root class="rounded-2xl border border-border/60 shadow-sm ring-0">
		<Card.Header class="gap-4 border-b border-border/70">
			<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<Card.Title>Users</Card.Title>
					<Card.Description>{data.total} total users</Card.Description>
				</div>
				<form method="GET" class="flex w-full gap-2 sm:max-w-sm">
					<label class="sr-only" for="admin-user-search">Search users</label>
					<div class="relative min-w-0 flex-1">
						<SearchIcon
							class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
						/>
						<input
							id="admin-user-search"
							name="search"
							value={data.search}
							placeholder="Search by email"
							class="h-10 w-full rounded-md border border-input bg-background pr-3 pl-9 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
						/>
					</div>
					<Button type="submit" variant="outline">Search</Button>
				</form>
			</div>
		</Card.Header>

		<Card.Content class="p-0">
			{#if data.errorMessage}
				<div class="px-6 py-10 text-sm text-destructive">{data.errorMessage}</div>
			{:else if users.length === 0}
				<div class="px-6 py-10 text-sm text-muted-foreground">No users found.</div>
			{:else}
				<div class="overflow-x-auto">
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>Name</Table.Head>
								<Table.Head>Email</Table.Head>
								<Table.Head>Role</Table.Head>
								<Table.Head>Banned</Table.Head>
								<Table.Head>Created</Table.Head>
								<Table.Head>Updated</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each users as user (user.id)}
								<Table.Row>
									<Table.Cell class="font-medium">{user.name || '-'}</Table.Cell>
									<Table.Cell>{user.email || '-'}</Table.Cell>
									<Table.Cell>{formatRoles(user.role)}</Table.Cell>
									<Table.Cell>{user.banned ? 'Yes' : 'No'}</Table.Cell>
									<Table.Cell>{formatDate(user.createdAt)}</Table.Cell>
									<Table.Cell>{formatDate(user.updatedAt)}</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				</div>
			{/if}
		</Card.Content>

		<Card.Footer class="flex flex-col gap-3 border-t border-border/70 sm:flex-row sm:justify-between">
			<p class="text-sm text-muted-foreground">
				Page {currentPage} of {totalPages}
			</p>
			<div class="flex gap-2">
				<Button href={previousHref} variant="outline" disabled={currentPage <= 1}>Previous</Button>
				<Button href={nextHref} variant="outline" disabled={currentPage >= totalPages}>Next</Button>
			</div>
		</Card.Footer>
	</Card.Root>
</PageShell>
