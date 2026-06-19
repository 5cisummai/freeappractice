<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { apiFetch } from '$lib/client/api.js';
	import type { HistoryResponse } from '$lib/types/history.js';
	import apClassesData from '$lib/data/ap-classes.json';
	import HistoryEntry from '$lib/components/history/history-entry.svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as NativeSelect from '$lib/components/ui/native-select/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import * as Accordion from '$lib/components/ui/accordion/index.js';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import PageShell from '$lib/components/page-shell.svelte';

	const PAGE_SIZE = 20;
	const subjects = (apClassesData.courses ?? []).map((c: { name: string }) => c.name).sort();

	let items = $state<HistoryResponse['items']>([]);
	let total = $state(0);
	let page = $state(1);
	let loading = $state(true);
	let errorMessage = $state('');
	let selectedApClass = $state('');

	const totalPages = $derived(Math.max(1, Math.ceil(total / PAGE_SIZE)));
	const hasPrev = $derived(page > 1);
	const hasNext = $derived(page < totalPages);

	async function loadHistory() {
		loading = true;
		errorMessage = '';
		try {
			const query = [
				`page=${page}`,
				`limit=${PAGE_SIZE}`,
				...(selectedApClass ? [`apClass=${encodeURIComponent(selectedApClass)}`] : [])
			].join('&');
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
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to load history.';
			items = [];
			total = 0;
		} finally {
			loading = false;
		}
	}

	function handleSubjectChange() {
		page = 1;
		void loadHistory();
	}

	function goToPage(nextPage: number) {
		page = nextPage;
		void loadHistory();
	}

	onMount(() => {
		void loadHistory();
	});
</script>

<svelte:head>
	<title>History – Free AP Practice</title>
</svelte:head>

<PageShell
	title="Question History"
	description="Questions you've answered while signed in. Newest attempts appear first."
>
	<Card.Root class="p-4">
		<div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
			<div class="space-y-2 sm:min-w-[220px]">
				<Label for="history-subject-filter">Subject</Label>
				<NativeSelect.Root
					id="history-subject-filter"
					bind:value={selectedApClass}
					onchange={handleSubjectChange}
					disabled={loading}
					class="w-full sm:w-[280px]"
				>
					<NativeSelect.Option value="">All subjects</NativeSelect.Option>
					{#each subjects as subject (subject)}
						<NativeSelect.Option value={subject}>{subject}</NativeSelect.Option>
					{/each}
				</NativeSelect.Root>
			</div>
			{#if !loading && total > 0}
				<p class="text-sm text-muted-foreground">
					{total} attempt{total === 1 ? '' : 's'}
					{#if selectedApClass}
						in {selectedApClass}
					{/if}
				</p>
			{/if}
		</div>
	</Card.Root>

	{#if loading}
		<div class="flex justify-center py-16">
			<Spinner />
		</div>
	{:else if errorMessage}
		<p class="text-sm text-destructive">{errorMessage}</p>
	{:else if items.length === 0}
		<div class="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
			<p>No practice history yet.</p>
			<p class="mt-2 text-sm">Answer questions while signed in to build your history.</p>
			<a
				href={resolve('/app/practice')}
				class="mt-4 inline-block text-sm underline underline-offset-4">Start practicing →</a
			>
		</div>
	{:else}
		<Accordion.Root type="multiple" class="space-y-3">
			{#each items as item, index (`${item.attempt.questionId}-${item.attempt.attemptedAt}-${index}`)}
				<HistoryEntry {item} value={`history-${page}-${index}`} />
			{/each}
		</Accordion.Root>

		{#if totalPages > 1}
			<div class="flex items-center justify-between gap-4 pt-2">
				<p class="text-sm text-muted-foreground">
					Page {page} of {totalPages}
				</p>
				<div class="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						disabled={!hasPrev || loading}
						onclick={() => goToPage(page - 1)}
					>
						<ChevronLeftIcon class="size-4" />
						Previous
					</Button>
					<Button
						variant="outline"
						size="sm"
						disabled={!hasNext || loading}
						onclick={() => goToPage(page + 1)}
					>
						Next
						<ChevronRightIcon class="size-4" />
					</Button>
				</div>
			</div>
		{/if}
	{/if}
</PageShell>
