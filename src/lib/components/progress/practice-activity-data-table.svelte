<script lang="ts">
	import { type SortingState, getCoreRowModel, getPaginationRowModel, getSortedRowModel } from '@tanstack/table-core';
	import type { HistoryItem } from '$lib/users/types.js';
	import { createHistoryColumns } from '$lib/components/history/history-columns.js';
	import HistoryDetailSheet from '$lib/components/history/history-detail-sheet.svelte';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { FlexRender, createSvelteTable } from '$lib/components/ui/data-table/index.js';

	const PAGE_SIZE = 20;
	const DEFAULT_SORTING: SortingState = [{ id: 'attemptedAt', desc: true }];

	let { items }: { items: HistoryItem[] } = $props();

	let sorting = $state<SortingState>(DEFAULT_SORTING);
	let pageIndex = $state(0);
	let detailOpen = $state(false);
	let selectedItem = $state<HistoryItem | null>(null);

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
			return items;
		},
		get columns() {
			return columns;
		},
		getRowId: (row, index) => `${itemKey(row)}-${index}`,
		state: {
			get sorting() {
				return sorting;
			},
			get pagination() {
				return { pageIndex, pageSize: PAGE_SIZE };
			}
		},
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		onSortingChange: (updater) => {
			sorting = typeof updater === 'function' ? updater(sorting) : updater;
			pageIndex = 0;
		},
		onPaginationChange: (updater) => {
			const next =
				typeof updater === 'function' ? updater({ pageIndex, pageSize: PAGE_SIZE }) : updater;
			pageIndex = next.pageIndex;
		}
	});

	const pageCount = $derived(table.getPageCount());
</script>

<div class="rounded-md border">
	<Table.Root>
		<caption class="sr-only">Practice activity with review actions</caption>
		<Table.Header>
			{#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
				<Table.Row>
					{#each headerGroup.headers as header (header.id)}
						<Table.Head class={header.column.id === 'subject' ? 'ps-4' : undefined}>
							{#if !header.isPlaceholder}
								<FlexRender content={header.column.columnDef.header} context={header.getContext()} />
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
					<Table.Cell colspan={columns.length} class="h-24 text-center text-muted-foreground">
						No practice activity yet.
					</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
</div>

{#if items.length > PAGE_SIZE}
	<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
		<p class="text-sm text-muted-foreground">
			Page {pageIndex + 1} of {pageCount}
		</p>
		<div class="flex items-center gap-2">
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
{/if}

{#key selectedItem ? itemKey(selectedItem) : 'empty'}
	<HistoryDetailSheet item={selectedItem} bind:open={detailOpen} />
{/key}
