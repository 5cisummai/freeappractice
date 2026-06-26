<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import SearchIcon from '@lucide/svelte/icons/search';
	import {
		type SortingState,
		type VisibilityState,
		getCoreRowModel,
		getSortedRowModel
	} from '@tanstack/table-core';
	import type { AdminUserRow } from '$lib/admin/types.js';
	import { createAdminUsersColumns } from './admin-users-columns.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { FlexRender, createSvelteTable } from '$lib/components/ui/data-table/index.js';

	type Props = {
		data: AdminUserRow[];
		total: number;
		page: number;
		pageSize: number;
		search: string;
		errorMessage: string | null;
	};

	let { data, total, page, pageSize, search, errorMessage }: Props = $props();

	let sorting = $state<SortingState>([{ id: 'createdAt', desc: true }]);
	let columnVisibility = $state<VisibilityState>({
		updatedAt: false,
		id: false
	});

	const pageCount = $derived(Math.max(1, Math.ceil(total / pageSize)));
	const columns = $derived(createAdminUsersColumns());

	function buildPageHref(nextPage: number): string {
		const params = [`tab=users`];
		if (search) params.push(`search=${encodeURIComponent(search)}`);
		if (nextPage > 1) params.push(`page=${nextPage}`);
		return `/app/admin?${params.join('&')}`;
	}

	const table = createSvelteTable({
		get data() {
			return data;
		},
		get columns() {
			return columns;
		},
		state: {
			get sorting() {
				return sorting;
			},
			get columnVisibility() {
				return columnVisibility;
			}
		},
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		onSortingChange: (updater) => {
			sorting = typeof updater === 'function' ? updater(sorting) : updater;
		},
		onColumnVisibilityChange: (updater) => {
			columnVisibility = typeof updater === 'function' ? updater(columnVisibility) : updater;
		}
	});
</script>

<div class="space-y-5">
	<div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
		<div class="space-y-1">
			<p class="text-sm font-medium">Users</p>
			<p class="text-xs text-muted-foreground">
				Server search and pagination; sorting applies to the current page.
			</p>
		</div>

		<div class="flex flex-col gap-3 sm:flex-row sm:items-center">
			<form method="GET" class="flex w-full gap-2 sm:w-[22rem]">
				<input type="hidden" name="tab" value="users" />
				<label class="sr-only" for="admin-user-search">Search users</label>
				<div class="relative min-w-0 flex-1">
					<SearchIcon
						class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
					/>
					<input
						id="admin-user-search"
						name="search"
						value={search}
						placeholder="Search by email"
						class="h-9 w-full rounded-md border border-input bg-background pr-3 pl-9 text-sm shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
					/>
				</div>
				<Button type="submit" variant="outline">Search</Button>
			</form>

			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<Button {...props} variant="outline">
							Columns
							<ChevronDownIcon class="ms-2 size-4" />
						</Button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="end">
					{#each table.getAllColumns().filter((column) => column.getCanHide()) as column (column.id)}
						<DropdownMenu.CheckboxItem
							class="capitalize"
							bind:checked={() => column.getIsVisible(), (value) => column.toggleVisibility(!!value)}
						>
							{column.id}
						</DropdownMenu.CheckboxItem>
					{/each}
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</div>
	</div>

	{#if errorMessage}
		<p class="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
			{errorMessage}
		</p>
	{:else}
		<div class="rounded-xl border border-border/70 bg-background">
			<Table.Root>
				<Table.Header>
					{#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
						<Table.Row>
							{#each headerGroup.headers as header (header.id)}
								<Table.Head>
									{#if !header.isPlaceholder}
										<FlexRender
											content={header.column.columnDef.header}
											context={header.getContext()}
										/>
									{/if}
								</Table.Head>
							{/each}
						</Table.Row>
					{/each}
				</Table.Header>
				<Table.Body>
					{#each table.getRowModel().rows as row (row.id)}
						<Table.Row>
							{#each row.getVisibleCells() as cell (cell.id)}
								<Table.Cell>
									<FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} />
								</Table.Cell>
							{/each}
						</Table.Row>
					{:else}
						<Table.Row>
							<Table.Cell colspan={columns.length} class="h-24 text-center text-muted-foreground">
								No users found for this search.
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>

		<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<p class="text-sm text-muted-foreground">
				Showing {(page - 1) * pageSize + (data.length ? 1 : 0)}-{(page - 1) * pageSize + data.length}
				of {total.toLocaleString()} users
			</p>
			<div class="flex items-center gap-2">
				<p class="text-sm text-muted-foreground">
					Page {page} of {pageCount}
				</p>
				<Button href={buildPageHref(Math.max(page - 1, 1))} variant="outline" disabled={page <= 1}>
					Previous
				</Button>
				<Button
					href={buildPageHref(Math.min(page + 1, pageCount))}
					variant="outline"
					disabled={page >= pageCount}
				>
					Next
				</Button>
			</div>
		</div>
	{/if}
</div>
