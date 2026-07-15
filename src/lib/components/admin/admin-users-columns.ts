import type { ColumnDef } from '@tanstack/table-core';
import { createRawSnippet } from 'svelte';
import { renderSnippet, renderComponent } from '$lib/components/ui/data-table/index.js';
import AdminDataTableSortButton from '$lib/components/admin/admin-data-table-sort-button.svelte';
import type { AdminUserRow } from '$lib/admin/types.js';

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function formatDate(value: Date | string | null | undefined): string {
	if (!value) return '-';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '-';
	return new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		timeZone: 'UTC'
	}).format(date);
}

function formatRole(role: AdminUserRow['role']): string {
	if (Array.isArray(role)) return role.join(', ');
	return role || 'user';
}

export function createAdminUsersColumns(): ColumnDef<AdminUserRow>[] {
	return [
		{
			accessorKey: 'name',
			id: 'name',
			header: ({ column }) =>
				renderComponent(AdminDataTableSortButton, {
					label: 'Name',
					onclick: column.getToggleSortingHandler()
				}),
			cell: ({ row }) => {
				const nameSnippet = createRawSnippet<[{ name: string; email: string }]>((getData) => {
					const { name, email } = getData();
					return {
						render: () =>
							`<div class="ph-mask-pii min-w-0"><div class="font-medium">${escapeHtml(name)}</div><div class="truncate text-xs text-muted-foreground sm:hidden">${escapeHtml(email)}</div></div>`
					};
				});

				return renderSnippet(nameSnippet, {
					name: row.original.name || 'Unnamed user',
					email: row.original.email || '-'
				});
			}
		},
		{
			accessorKey: 'email',
			id: 'email',
			header: ({ column }) =>
				renderComponent(AdminDataTableSortButton, {
					label: 'Email',
					onclick: column.getToggleSortingHandler()
				}),
			cell: ({ row }) => {
				const emailSnippet = createRawSnippet<[{ email: string }]>((getData) => {
					const { email } = getData();
					return {
						render: () => `<span class="ph-mask-pii">${escapeHtml(email)}</span>`
					};
				});
				return renderSnippet(emailSnippet, { email: row.original.email || '-' });
			}
		},
		{
			accessorKey: 'role',
			id: 'role',
			header: ({ column }) =>
				renderComponent(AdminDataTableSortButton, {
					label: 'Role',
					onclick: column.getToggleSortingHandler()
				}),
			cell: ({ row }) => {
				const roleSnippet = createRawSnippet<[{ role: string }]>((getData) => {
					const { role } = getData();
					return {
						render: () =>
							`<span class="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">${escapeHtml(role)}</span>`
					};
				});
				return renderSnippet(roleSnippet, { role: formatRole(row.original.role) });
			},
			sortingFn: (rowA, rowB) =>
				formatRole(rowA.original.role).localeCompare(formatRole(rowB.original.role))
		},
		{
			accessorKey: 'banned',
			id: 'banned',
			header: ({ column }) =>
				renderComponent(AdminDataTableSortButton, {
					label: 'Status',
					onclick: column.getToggleSortingHandler()
				}),
			cell: ({ row }) => {
				const statusSnippet = createRawSnippet<[{ banned: boolean }]>((getData) => {
					const { banned } = getData();
					const classes = banned
						? 'border-destructive/20 bg-destructive/10 text-destructive'
						: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
					const label = banned ? 'Banned' : 'Active';
					return {
						render: () =>
							`<span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${classes}">${label}</span>`
					};
				});
				return renderSnippet(statusSnippet, { banned: !!row.original.banned });
			},
			sortingFn: (rowA, rowB) => Number(!!rowA.original.banned) - Number(!!rowB.original.banned)
		},
		{
			accessorKey: 'createdAt',
			id: 'createdAt',
			header: ({ column }) =>
				renderComponent(AdminDataTableSortButton, {
					label: 'Joined',
					onclick: column.getToggleSortingHandler()
				}),
			cell: ({ row }) => formatDate(row.original.createdAt),
			sortingFn: (rowA, rowB) =>
				new Date(rowA.original.createdAt ?? 0).getTime() -
				new Date(rowB.original.createdAt ?? 0).getTime()
		},
		{
			accessorKey: 'updatedAt',
			id: 'updatedAt',
			header: ({ column }) =>
				renderComponent(AdminDataTableSortButton, {
					label: 'Updated',
					onclick: column.getToggleSortingHandler()
				}),
			cell: ({ row }) => formatDate(row.original.updatedAt),
			sortingFn: (rowA, rowB) =>
				new Date(rowA.original.updatedAt ?? 0).getTime() -
				new Date(rowB.original.updatedAt ?? 0).getTime()
		},
		{
			accessorKey: 'id',
			id: 'id',
			header: 'User ID',
			cell: ({ row }) => {
				const idSnippet = createRawSnippet<[{ id: string }]>((getData) => {
					const { id } = getData();
					return {
						render: () =>
							`<code class="ph-mask-pii block max-w-[16rem] truncate text-xs text-muted-foreground">${escapeHtml(id)}</code>`
					};
				});
				return renderSnippet(idSnippet, { id: row.original.id });
			},
			enableSorting: false
		}
	];
}
