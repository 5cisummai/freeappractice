import type { ColumnDef } from '@tanstack/table-core';
import { createRawSnippet } from 'svelte';
import type { HistoryItem } from '$lib/types/history.js';
import {
	escapeHtml,
	formatAttemptDate,
	formatTimeTaken,
	plainQuestionText,
	questionPreview
} from '$lib/history-display.js';
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
					indeterminate:
						table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected(),
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
				const subjectSnippet = createRawSnippet<[{ subject: string; unit: string }]>(
					(getData) => {
						const { subject, unit } = getData();
						const unitHtml = unit
							? `<span class="text-muted-foreground"> · ${escapeHtml(unit)}</span>`
							: '';
						return {
							render: () =>
								`<div class="font-medium">${escapeHtml(subject)}${unitHtml}</div>`
						};
					}
				);
				return renderSnippet(subjectSnippet, {
					subject: row.original.attempt.apClass,
					unit: row.original.attempt.unit ?? ''
				});
			},
			sortingFn: (rowA, rowB) =>
				rowA.original.attempt.apClass.localeCompare(rowB.original.attempt.apClass)
		},
		{
			id: 'question',
			accessorFn: (row) => plainQuestionText(row.question?.question ?? ''),
			header: 'Question',
			cell: ({ row }) => {
				const questionSnippet = createRawSnippet<[{ preview: string }]>((getData) => {
					const { preview } = getData();
					return {
						render: () =>
							`<div class="max-w-md truncate text-sm text-muted-foreground">${escapeHtml(preview)}</div>`
					};
				});
				return renderSnippet(questionSnippet, {
					preview: questionPreview(row.original)
				});
			},
			filterFn: 'includesString'
		},
		{
			id: 'attemptedAt',
			accessorFn: (row) => new Date(row.attempt.attemptedAt).getTime(),
			header: ({ column }) =>
				renderComponent(HistoryDataTableSortButton, {
					label: 'Date',
					onclick: column.getToggleSortingHandler()
				}),
			cell: ({ row }) => {
				const dateSnippet = createRawSnippet<[{ date: string; time: string | null }]>(
					(getData) => {
						const { date, time } = getData();
						const timeHtml = time
							? `<span class="text-muted-foreground"> · ${time}</span>`
							: '';
						return {
							render: () =>
								`<div class="text-sm whitespace-nowrap">${date}${timeHtml}</div>`
						};
					}
				);
				return renderSnippet(dateSnippet, {
					date: formatAttemptDate(row.original.attempt.attemptedAt),
					time: formatTimeTaken(row.original.attempt.timeTakenMs)
				});
			}
		},
		{
			accessorKey: 'attempt.selectedAnswer',
			id: 'answer',
			header: 'Your answer',
			cell: ({ row }) => {
				const answerSnippet = createRawSnippet<[{ answer: string }]>((getData) => {
					const { answer } = getData();
					return {
						render: () => `<div class="font-medium tabular-nums">${answer}</div>`
					};
				});
				return renderSnippet(answerSnippet, {
					answer: row.original.attempt.selectedAnswer
				});
			},
			enableSorting: false
		},
		{
			accessorKey: 'attempt.wasCorrect',
			id: 'result',
			header: ({ column }) =>
				renderComponent(HistoryDataTableSortButton, {
					label: 'Result',
					onclick: column.getToggleSortingHandler()
				}),
			cell: ({ row }) => {
				const resultSnippet = createRawSnippet<[{ correct: boolean }]>((getData) => {
					const { correct } = getData();
					const label = correct ? 'Correct' : 'Incorrect';
					const classes = correct
						? 'bg-secondary text-secondary-foreground'
						: 'bg-destructive/10 text-destructive';
					return {
						render: () =>
							`<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes}">${label}</span>`
					};
				});
				return renderSnippet(resultSnippet, {
					correct: row.original.attempt.wasCorrect
				});
			},
			sortingFn: (rowA, rowB) =>
				Number(rowB.original.attempt.wasCorrect) - Number(rowA.original.attempt.wasCorrect)
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
