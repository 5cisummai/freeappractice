import type { ColumnDef } from '@tanstack/table-core';
import { createRawSnippet } from 'svelte';
import type { HistoryItem } from '$lib/users/types.js';
import { escapeHtml, formatAttemptDate, formatTimeTaken } from '$lib/history-display.js';
import { renderComponent, renderSnippet } from '$lib/components/ui/data-table/index.js';
import HistoryDataTableCheckbox from './history-data-table-checkbox.svelte';
import HistoryDataTableSortButton from './history-data-table-sort-button.svelte';
import HistoryDataTableActions from './history-data-table-actions.svelte';

export function createHistoryColumns(
	onViewDetails: (item: HistoryItem) => void
): ColumnDef<HistoryItem>[] {
	return [
		{
			id: 'select',
			header: ({ table }) =>
				renderComponent(HistoryDataTableCheckbox, {
					checked: table.getIsAllPageRowsSelected(),
					indeterminate: table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected(),
					onCheckedChange: (value) => table.toggleAllPageRowsSelected(!!value),
					'aria-label': 'Select all'
				}),
			cell: ({ row }) =>
				renderComponent(HistoryDataTableCheckbox, {
					checked: row.getIsSelected(),
					onCheckedChange: (value) => row.toggleSelected(!!value),
					'aria-label': 'Select row'
				}),
			enableSorting: false,
			enableHiding: false
		},
		{
			accessorKey: 'attempt.apClass',
			id: 'subject',
			header: ({ column }) =>
				renderComponent(HistoryDataTableSortButton, {
					label: 'Subject',
					onclick: column.getToggleSortingHandler()
				}),
			cell: ({ row }) => {
				const subjectSnippet = createRawSnippet<[{ subject: string; unit: string }]>((getData) => {
					const { subject, unit } = getData();
					const unitHtml = unit
						? `<span class="text-muted-foreground"> · ${escapeHtml(unit)}</span>`
						: '';
					return {
						render: () => `<div class="font-medium">${escapeHtml(subject)}${unitHtml}</div>`
					};
				});
				return renderSnippet(subjectSnippet, {
					subject: row.original.attempt.apClass,
					unit: row.original.attempt.unit ?? ''
				});
			},
			sortingFn: (rowA, rowB) =>
				rowA.original.attempt.apClass.localeCompare(rowB.original.attempt.apClass)
		},
		{
			id: 'attemptedAt',
			accessorFn: (row) => new Date(row.attempt.attemptedAt).getTime(),
			header: ({ column }) =>
				renderComponent(HistoryDataTableSortButton, {
					label: 'Date · Time taken',
					onclick: column.getToggleSortingHandler()
				}),
			cell: ({ row }) => {
				const dateSnippet = createRawSnippet<[{ date: string; time: string | null }]>((getData) => {
					const { date, time } = getData();
					const timeHtml = time
						? `<span class="text-muted-foreground"> · ${escapeHtml(time)}</span>`
						: '';
					return {
						render: () => `<div class="text-sm whitespace-nowrap">${date}${timeHtml}</div>`
					};
				});
				return renderSnippet(dateSnippet, {
					date: formatAttemptDate(row.original.attempt.attemptedAt),
					time: formatTimeTaken(row.original.attempt.timeTakenMs)
				});
			}
		},
		{
			id: 'answer',
			accessorFn: (row) =>
				row.kind === 'mcq' ? (row.attempt.selectedAnswer ?? '') : row.attempt.percentage,
			header: 'Answer / score',
			cell: ({ row }) => {
				const answerSnippet = createRawSnippet<[{ answer: string }]>((getData) => {
					const { answer } = getData();
					return {
						render: () => `<div class="font-medium tabular-nums">${escapeHtml(answer)}</div>`
					};
				});
				return renderSnippet(answerSnippet, {
					answer:
						row.original.kind === 'mcq'
							? (row.original.attempt.selectedAnswer ?? '—')
							: `${row.original.attempt.pointsEarned}/${row.original.attempt.pointsAvailable} (${row.original.attempt.percentage}%)`
				});
			},
			enableSorting: false
		},
		{
			id: 'result',
			accessorFn: (row) =>
				row.kind === 'mcq' ? (row.attempt.wasCorrect ? 1 : 0) : row.attempt.percentage,
			header: ({ column }) =>
				renderComponent(HistoryDataTableSortButton, {
					label: 'Result',
					onclick: column.getToggleSortingHandler()
				}),
			cell: ({ row }) => {
				const resultSnippet = createRawSnippet<[{ label: string; classes: string }]>((getData) => {
					const { label, classes } = getData();
					return {
						render: () =>
							`<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes}">${label}</span>`
					};
				});
				const result =
					row.original.kind === 'frq'
						? {
								label: `${row.original.attempt.percentage}%`,
								classes:
									row.original.attempt.percentage >= 70
										? 'bg-secondary text-secondary-foreground'
										: 'bg-muted text-muted-foreground'
							}
						: {
								label:
									row.original.attempt.wasCorrect === undefined
										? 'Revealed'
										: row.original.attempt.wasCorrect
											? 'Correct'
											: 'Incorrect',
								classes:
									row.original.attempt.wasCorrect === undefined
										? 'bg-muted text-muted-foreground'
										: row.original.attempt.wasCorrect
											? 'bg-secondary text-secondary-foreground'
											: 'bg-destructive/10 text-destructive'
							};
				return renderSnippet(resultSnippet, {
					...result
				});
			},
			sortingFn: (rowA, rowB) => {
				const score = (item: HistoryItem) =>
					item.kind === 'frq'
						? item.attempt.percentage
						: item.attempt.wasCorrect === undefined
							? -1
							: item.attempt.wasCorrect
								? 100
								: 0;
				return score(rowB.original) - score(rowA.original);
			}
		},
		{
			id: 'actions',
			enableHiding: false,
			cell: ({ row }) =>
				renderComponent(HistoryDataTableActions, {
					item: row.original,
					onView: onViewDetails
				})
		}
	];
}
