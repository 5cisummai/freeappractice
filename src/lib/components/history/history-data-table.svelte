<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import {
		type RowSelectionState,
		type SortingState,
		type VisibilityState,
		getCoreRowModel
	} from '@tanstack/table-core';
	import type { HistoryItem } from '$lib/users/types.js';
	import { createHistoryColumns } from './history-columns.js';
	import HistoryDetailSheet from './history-detail-sheet.svelte';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { FlexRender, createSvelteTable } from '$lib/components/ui/data-table/index.js';

	type HistoryDataTableProps = {
		data: HistoryItem[];
		total: number;
		pageIndex: number;
		pageSize: number;
		sorting: SortingState;
		onPageChange: (pageIndex: number) => void;
		onSortingChange: (sorting: SortingState) => void;
	};

	let {
		data,
		total,
		pageIndex,
		pageSize,
		sorting,
		onPageChange,
		onSortingChange
	}: HistoryDataTableProps = $props();

	let columnVisibility = $state<VisibilityState>({});
	let rowSelection = $state<RowSelectionState>({});
	let detailOpen = $state(false);
	let selectedItem = $state<HistoryItem | null>(null);

	const pageCount = $derived(Math.max(1, Math.ceil(total / pageSize)));

	const columns = $derived(createHistoryColumns(viewDetails));

	function viewDetails(item: HistoryItem) {
		selectedItem = item;
		detailOpen = true;
	}

	function handleRowKeydown(event: KeyboardEvent, item: HistoryItem) {
		if (event.target !== event.currentTarget) return;
		if (event.key !== 'Enter' && event.key !== ' ') return;

		event.preventDefault();
		viewDetails(item);
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
		getRowId: (row, index) =>
			`${row.kind}-${row.attempt.questionId}-${row.attempt.attemptedAt}-${index}`,
		state: {
			get pagination() {
				return { pageIndex, pageSize };
			},
			get sorting() {
				return sorting;
			},
			get columnVisibility() {
				return columnVisibility;
			},
			get rowSelection() {
				return rowSelection;
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
		},
		onRowSelectionChange: (updater) => {
			rowSelection = typeof updater === 'function' ? updater(rowSelection) : updater;
		}
	});
</script>

<div class="space-y-4">
	<div class="flex flex-col gap-3 sm:flex-row sm:items-center">
		<p class="text-xs text-muted-foreground">
			Sorting applies across all attempts, not just this page.
		</p>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Button {...props} variant="outline" class="sm:ms-auto">
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
			<Table.Header>
				{#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
					<Table.Row>
						{#each headerGroup.headers as header (header.id)}
							<Table.Head class="[&:has([role=checkbox])]:ps-3">
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
					<Table.Row
						data-state={row.getIsSelected() && 'selected'}
						class="cursor-pointer"
						tabindex={0}
						aria-label="View question details"
						onclick={() => viewDetails(row.original)}
						onkeydown={(event) => handleRowKeydown(event, row.original)}
					>
						{#each row.getVisibleCells() as cell (cell.id)}
							<Table.Cell
								class="[&:has([role=checkbox])]:ps-3"
								onclick={(e) => {
									if (cell.column.id === 'select' || cell.column.id === 'actions') {
										e.stopPropagation();
									}
								}}
							>
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

	<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<p class="text-sm text-muted-foreground">
			{table.getSelectedRowModel().rows.length} of
			{table.getRowModel().rows.length} row(s) selected on this page · {total} total attempt{total ===
			1
				? ''
				: 's'}
		</p>
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

{#key selectedItem ? selectedItem.kind + ':' + selectedItem.attempt.questionId + ':' + selectedItem.attempt.attemptedAt : 'empty'}
	<HistoryDetailSheet item={selectedItem} bind:open={detailOpen} />
{/key}
