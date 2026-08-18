<script lang="ts">
	import ChevronDownIcon from '@tabler/icons-svelte/icons/chevron-down';
	import FilterIcon from '@tabler/icons-svelte/icons/filter-filled';
	import SearchIcon from '@tabler/icons-svelte/icons/search-filled';
	import type { Snippet } from 'svelte';
	import { type SortingState, type VisibilityState, getCoreRowModel } from '@tanstack/table-core';
	import type { HistoryItem } from '$lib/users/types.js';
	import { createHistoryColumns } from './history-columns.js';
	import HistoryDetailSheet from './history-detail-sheet.svelte';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { FlexRender, createSvelteTable } from '$lib/components/ui/data-table/index.js';

	type HistoryDataTableProps = {
		data: HistoryItem[];
		total: number;
		pageIndex: number;
		pageSize: number;
		sorting: SortingState;
		search: string;
		filtersOpen?: boolean;
		filterContent: Snippet;
		onPageChange: (pageIndex: number) => void;
		onSortingChange: (sorting: SortingState) => void;
		onSearchChange: (search: string) => void;
	};

	let {
		data,
		total,
		pageIndex,
		pageSize,
		sorting,
		search,
		filtersOpen = $bindable(false),
		filterContent,
		onPageChange,
		onSortingChange,
		onSearchChange
	}: HistoryDataTableProps = $props();

	let columnVisibility = $state<VisibilityState>({});
	let detailOpen = $state(false);
	let selectedItem = $state<HistoryItem | null>(null);

	const pageCount = $derived(Math.max(1, Math.ceil(total / pageSize)));

	const columns = $derived(createHistoryColumns(viewDetails));

	function viewDetails(item: HistoryItem) {
		selectedItem = item;
		detailOpen = true;
	}

	function itemKey(item: HistoryItem): string {
		return `${item.kind}-${item.kind === 'mcq' ? item.attempt.questionId : item.attempt.id}-${item.attempt.attemptedAt}`;
	}

	const table = createSvelteTable({
		get data() {
			return data;
		},
		get columns() {
			return columns;
		},
		manualPagination: true,
		manualSorting: true,
		get pageCount() {
			return pageCount;
		},
		getRowId: (row, index) => `${itemKey(row)}-${index}`,
		state: {
			get pagination() {
				return { pageIndex, pageSize };
			},
			get sorting() {
				return sorting;
			},
			get columnVisibility() {
				return columnVisibility;
			}
		},
		getCoreRowModel: getCoreRowModel(),
		onPaginationChange: (updater) => {
			const current = { pageIndex, pageSize };
			const next = typeof updater === 'function' ? updater(current) : updater;
			if (next.pageIndex !== pageIndex) {
				onPageChange(next.pageIndex);
			}
		},
		onSortingChange: (updater) => {
			const next = typeof updater === 'function' ? updater(sorting) : updater;
			onSortingChange(next);
		},
		onColumnVisibilityChange: (updater) => {
			columnVisibility = typeof updater === 'function' ? updater(columnVisibility) : updater;
		}
	});
</script>

<div class="space-y-4">
	<div class="flex flex-col gap-3 sm:flex-row sm:items-center">
		<label class="sr-only" for="history-search">Search history</label>
		<div class="relative min-w-0 flex-1 sm:max-w-sm">
			<SearchIcon
				class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
			/>
			<input
				id="history-search"
				type="search"
				value={search}
				placeholder="Search by subject or unit"
				oninput={(e) => onSearchChange(e.currentTarget.value)}
				class="h-9 w-full rounded-md border border-input bg-background pr-3 pl-9 text-sm shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
			/>
		</div>

		<Popover.Root bind:open={filtersOpen}>
			<Popover.Trigger>
				{#snippet child({ props })}
					<Button {...props} variant="ghost" class="sm:ms-auto" aria-controls="history-filters">
						<FilterIcon class="size-4" aria-hidden="true" />
						Filters
					</Button>
				{/snippet}
			</Popover.Trigger>
			<Popover.Content align="end" class="w-[min(22rem,calc(100vw-2rem))]">
				{@render filterContent()}
			</Popover.Content>
		</Popover.Root>

		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Button {...props} variant="ghost">
						Columns
						<ChevronDownIcon class="ms-2 size-4" />
					</Button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end">
				{#each table.getAllColumns().filter((col) => col.getCanHide()) as column (column.id)}
					<DropdownMenu.CheckboxItem
						class="capitalize"
						bind:checked={() => column.getIsVisible(), (v) => column.toggleVisibility(!!v)}
					>
						{column.id}
					</DropdownMenu.CheckboxItem>
				{/each}
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>

	<div class="rounded-md border">
		<Table.Root>
			<caption class="sr-only">Question history with review actions</caption>
			<Table.Header>
				{#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
					<Table.Row>
						{#each headerGroup.headers as header (header.id)}
							<Table.Head class={header.column.id === 'subject' ? 'ps-4' : undefined}>
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
					<Table.Row class="even:bg-muted/30">
						{#each row.getVisibleCells() as cell (cell.id)}
							<Table.Cell class={cell.column.id === 'subject' ? 'ps-4' : undefined}>
								<FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} />
							</Table.Cell>
						{/each}
					</Table.Row>
				{:else}
					<Table.Row>
						<Table.Cell colspan={columns.length} class="h-24 text-center">
							No results on this page.
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>

	<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
		<div class="flex items-center gap-2">
			<p class="text-sm text-muted-foreground">
				Page {pageIndex + 1} of {pageCount}
			</p>
			<Button
				variant="outline"
				size="sm"
				onclick={() => table.previousPage()}
				disabled={!table.getCanPreviousPage()}
			>
				Previous
			</Button>
			<Button
				variant="outline"
				size="sm"
				onclick={() => table.nextPage()}
				disabled={!table.getCanNextPage()}
			>
				Next
			</Button>
		</div>
	</div>
</div>

{#key selectedItem ? itemKey(selectedItem) : 'empty'}
	<HistoryDetailSheet item={selectedItem} bind:open={detailOpen} />
{/key}
