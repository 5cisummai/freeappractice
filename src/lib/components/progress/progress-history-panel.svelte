<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { apiFetch } from '$lib/client/api.js';
	import type { HistoryResponse } from '$lib/types/history.js';
	import HistoryDataTable from '$lib/components/history/history-data-table.svelte';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import { appEmptyState } from '$lib/app-ui.js';

	const PAGE_SIZE = 20;

	let items = $state<HistoryResponse['items']>([]);
	let total = $state(0);
	let pageIndex = $state(0);
	let loading = $state(true);
	let errorMessage = $state('');

	async function loadHistory() {
		loading = true;
		errorMessage = '';
		try {
			const query = [`page=${pageIndex + 1}`, `limit=${PAGE_SIZE}`].join('&');
			const response = await apiFetch(`/api/me/history?${query}`);
			if (!response.ok) {
				const payload = await response.json().catch(() => ({}));
				throw new Error(
					typeof payload.error === 'string' ? payload.error : 'Failed to load history.'
				);
			}
			const data = (await response.json()) as HistoryResponse;
			items = data.items ?? [];
			total = data.total ?? 0;

			const maxPageIndex = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
			if (pageIndex > maxPageIndex) {
				pageIndex = maxPageIndex;
				await loadHistory();
				return;
			}
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to load history.';
			items = [];
			total = 0;
		} finally {
			loading = false;
		}
	}

	function handlePageChange(nextPageIndex: number) {
		pageIndex = nextPageIndex;
		void loadHistory();
	}

	onMount(() => {
		void loadHistory();
	});
</script>

{#if loading}
	<div class="flex justify-center py-16">
		<Spinner />
	</div>
{:else if errorMessage}
	<p class="text-sm text-destructive">{errorMessage}</p>
{:else if items.length === 0}
	<div class={appEmptyState}>
		<p>No practice history yet.</p>
		<p class="mt-2 text-sm">Answer questions while signed in to build your history.</p>
		<a
			href={resolve('/app/practice')}
			class="mt-4 inline-block text-sm underline underline-offset-4 hover:text-foreground"
		>
			Start practicing →
		</a>
	</div>
{:else}
	<HistoryDataTable
		data={items}
		{total}
		{pageIndex}
		pageSize={PAGE_SIZE}
		onPageChange={handlePageChange}
	/>
{/if}
