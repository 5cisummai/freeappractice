<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { apiFetch, readJsonOrNull } from '$lib/client/api.js';
	import type { HistoryResponse } from '$lib/users/types.js';
	import HistoryDataTable from '$lib/components/history/history-data-table.svelte';
	import { Spinner } from '$lib/components/ui/spinner/index.js';

	const PAGE_SIZE = 20;

	let items = $state<HistoryResponse['items']>([]);
	let total = $state(0);
	let pageIndex = $state(0);
	let loading = $state(true);
	let errorMessage = $state('');
	let loadSequence = 0;

	async function loadHistory(requestedPageIndex = pageIndex) {
		const sequence = ++loadSequence;
		loading = true;
		errorMessage = '';
		try {
			const query = [`page=${requestedPageIndex + 1}`, `limit=${PAGE_SIZE}`].join('&');
			const response = await apiFetch(`/api/me/history?${query}`);
			const payload = await readJsonOrNull<HistoryResponse & { error?: string }>(response);
			if (!response.ok) {
				throw new Error(
					typeof payload?.error === 'string' ? payload.error : 'Failed to load history.'
				);
			}
			if (sequence !== loadSequence) return;

			const data = payload as HistoryResponse;
			items = data.items ?? [];
			total = data.total ?? 0;

			const maxPageIndex = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
			if (requestedPageIndex > maxPageIndex) {
				pageIndex = maxPageIndex;
				await loadHistory(maxPageIndex);
				return;
			}
			pageIndex = requestedPageIndex;
		} catch (err) {
			if (sequence !== loadSequence) return;
			errorMessage = err instanceof Error ? err.message : 'Failed to load history.';
			items = [];
			total = 0;
		} finally {
			if (sequence === loadSequence) {
				loading = false;
			}
		}
	}

	function handlePageChange(nextPageIndex: number) {
		void loadHistory(nextPageIndex);
	}

	onMount(() => {
		void loadHistory(0);
	});
</script>

{#if loading}
	<div class="flex justify-center py-16">
		<Spinner />
	</div>
{:else if errorMessage}
	<p class="text-sm text-destructive">{errorMessage}</p>
{:else if items.length === 0}
	<div
		class="rounded-2xl border border-dashed border-border/70 p-12 text-center text-muted-foreground"
	>
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
