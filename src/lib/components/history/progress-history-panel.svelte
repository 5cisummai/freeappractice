<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { apiFetch, readJsonOrNull } from '$lib/client/api.js';
	import type { HistoryResponse } from '$lib/users/types.js';
	import HistoryDataTable from '$lib/components/history/history-data-table.svelte';
	import EmptyState from '$lib/components/app/empty-state.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	const notebookImage = '/illustrations/notebook.png';
	import type { SortingState } from '@tanstack/table-core';

	const PAGE_SIZE = 20;
	const DEFAULT_SORTING: SortingState = [{ id: 'attemptedAt', desc: true }];
	const SEARCH_DEBOUNCE_MS = 300;
	const ALL_FILTER_VALUE = '__all__';

	type ResultFilter = '' | 'correct' | 'incorrect';
	type KindFilter = '' | 'mcq' | 'frq' | 'quiz';
	type HistoryFilters = {
		apClass: string;
		unit: string;
		result: ResultFilter;
		kind: KindFilter;
		from: string;
		to: string;
	};
	type UnitOption = { apClass: string; unit: string };

	let {
		subjects = [],
		units = []
	}: {
		subjects?: string[];
		units?: UnitOption[];
	} = $props();

	let items = $state<HistoryResponse['items']>([]);
	let total = $state(0);
	let pageIndex = $state(0);
	let sorting = $state<SortingState>(DEFAULT_SORTING);
	let search = $state('');
	let filtersOpen = $state(false);
	let filters = $state<HistoryFilters>({
		apClass: '',
		unit: '',
		result: '',
		kind: '',
		from: '',
		to: ''
	});
	let loading = $state(true);
	let hasLoaded = $state(false);
	let errorMessage = $state('');
	let loadSequence = 0;
	let searchTimer: ReturnType<typeof setTimeout> | undefined;

	const filteredUnits = $derived(
		units
			.filter((unit) => !filters.apClass || unit.apClass === filters.apClass)
			.map((unit) => unit.unit)
			.filter((unit, index, all) => unit && all.indexOf(unit) === index)
			.sort((a, b) => a.localeCompare(b))
	);

	const hasActiveFilters = $derived(
		Boolean(
			filters.apClass ||
			filters.unit ||
			filters.result ||
			filters.kind ||
			filters.from ||
			filters.to ||
			search
		)
	);

	function sortParams(sortState: SortingState): { sortBy: string; sortDir: 'asc' | 'desc' } {
		const primary = sortState[0];
		if (!primary) return { sortBy: 'attemptedAt', sortDir: 'desc' };
		return {
			sortBy: primary.id,
			sortDir: primary.desc ? 'desc' : 'asc'
		};
	}

	async function loadHistory(
		requestedPageIndex = pageIndex,
		requestedSorting = sorting,
		requestedSearch = search,
		requestedFilters = filters
	) {
		const sequence = ++loadSequence;
		loading = true;
		errorMessage = '';
		try {
			const { sortBy, sortDir } = sortParams(requestedSorting);
			const queryParts = [
				`page=${requestedPageIndex + 1}`,
				`limit=${PAGE_SIZE}`,
				`sortBy=${encodeURIComponent(sortBy)}`,
				`sortDir=${sortDir}`
			];
			const filterParams: Record<string, string> = {
				apClass: requestedFilters.apClass,
				unit: requestedFilters.unit,
				result: requestedFilters.result,
				kind: requestedFilters.kind,
				from: requestedFilters.from,
				to: requestedFilters.to,
				search: requestedSearch
			};
			for (const [key, value] of Object.entries(filterParams)) {
				if (value) queryParts.push(`${key}=${encodeURIComponent(value)}`);
			}

			const response = await apiFetch(`/api/me/history?${queryParts.join('&')}`);
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
			sorting = requestedSorting;
			hasLoaded = true;

			const maxPageIndex = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
			if (requestedPageIndex > maxPageIndex) {
				pageIndex = maxPageIndex;
				await loadHistory(maxPageIndex, requestedSorting, requestedSearch, requestedFilters);
				return;
			}
			pageIndex = requestedPageIndex;
		} catch (err) {
			if (sequence !== loadSequence) return;
			errorMessage = err instanceof Error ? err.message : 'Failed to load history.';
			items = [];
			total = 0;
		} finally {
			if (sequence === loadSequence) loading = false;
		}
	}

	function handlePageChange(nextPageIndex: number) {
		void loadHistory(nextPageIndex, sorting, search, filters);
	}

	function handleSortingChange(nextSorting: SortingState) {
		void loadHistory(0, nextSorting.length ? nextSorting : DEFAULT_SORTING, search, filters);
	}

	function handleSearchChange(nextSearch: string) {
		search = nextSearch;
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			void loadHistory(0, sorting, nextSearch, filters);
		}, SEARCH_DEBOUNCE_MS);
	}

	function applyFilter(nextFilters: HistoryFilters) {
		filters = nextFilters;
		void loadHistory(0, sorting, search, nextFilters);
	}

	function handleSubjectChange(value: string) {
		applyFilter({ ...filters, apClass: value, unit: '' });
	}

	function selectFilterValue(value: string | undefined): string {
		return value && value !== ALL_FILTER_VALUE ? value : '';
	}

	function clearFilters() {
		const cleared: HistoryFilters = {
			apClass: '',
			unit: '',
			result: '',
			kind: '',
			from: '',
			to: ''
		};
		search = '';
		applyFilter(cleared);
	}

	onMount(() => {
		void loadHistory(0, sorting, search, filters);
		return () => clearTimeout(searchTimer);
	});
</script>

{#if !hasLoaded && loading}
	<div class="flex justify-center py-16">
		<Spinner />
	</div>
{:else if errorMessage && !hasLoaded}
	<p class="text-sm text-destructive" role="alert">{errorMessage}</p>
{:else if items.length === 0 && !hasActiveFilters}
	<EmptyState
		title="No practice history yet"
		description="Answer questions while signed in to build your history."
		imageUrl={notebookImage}
	>
		{#snippet button()}
			<Button href={resolve('/app/practice')}>Start practice</Button>
		{/snippet}
	</EmptyState>
{:else}
	<div class="space-y-6">
		{#if errorMessage}
			<p class="text-sm text-destructive" role="alert">{errorMessage}</p>
		{/if}
		<HistoryDataTable
			data={items}
			{total}
			{pageIndex}
			pageSize={PAGE_SIZE}
			{sorting}
			{search}
			bind:filtersOpen
			onPageChange={handlePageChange}
			onSortingChange={handleSortingChange}
			onSearchChange={handleSearchChange}
		>
			{#snippet filterContent()}
				<div id="history-filters" class="space-y-3">
					<div class="flex items-center justify-between gap-3">
						<p class="font-medium">Filter history</p>
						{#if hasActiveFilters}
							<Button variant="ghost" size="sm" class="h-7 px-2" onclick={clearFilters}>
								Clear
							</Button>
						{/if}
					</div>
					<div class="grid gap-3 sm:grid-cols-2">
						<label class="space-y-1 text-xs">
							<span class="font-medium text-muted-foreground">Subject</span>
							<Select.Root
								type="single"
								value={filters.apClass || ALL_FILTER_VALUE}
								onValueChange={(value) => handleSubjectChange(selectFilterValue(value))}
							>
								<Select.Trigger class="h-8 w-full" aria-label="Subject">
									{filters.apClass || 'All subjects'}
								</Select.Trigger>
								<Select.Content>
									<Select.Item value={ALL_FILTER_VALUE}>All subjects</Select.Item>
									{#each subjects as subject (subject)}
										<Select.Item value={subject}>{subject}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</label>
						<label class="space-y-1 text-xs">
							<span class="font-medium text-muted-foreground">Unit</span>
							<Select.Root
								type="single"
								value={filters.unit || ALL_FILTER_VALUE}
								onValueChange={(value) =>
									applyFilter({ ...filters, unit: selectFilterValue(value) })}
							>
								<Select.Trigger class="h-8 w-full" aria-label="Unit">
									{filters.unit || 'All units'}
								</Select.Trigger>
								<Select.Content>
									<Select.Item value={ALL_FILTER_VALUE}>All units</Select.Item>
									{#each filteredUnits as unit (unit)}
										<Select.Item value={unit}>{unit}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</label>
						<label class="space-y-1 text-xs">
							<span class="font-medium text-muted-foreground">Result</span>
							<Select.Root
								type="single"
								value={filters.result || ALL_FILTER_VALUE}
								onValueChange={(value) =>
									applyFilter({
										...filters,
										result: selectFilterValue(value) as ResultFilter
									})}
							>
								<Select.Trigger class="h-8 w-full" aria-label="Result">
									{filters.result === 'correct'
										? 'Correct'
										: filters.result === 'incorrect'
											? 'Incorrect'
											: 'All results'}
								</Select.Trigger>
								<Select.Content>
									<Select.Item value={ALL_FILTER_VALUE}>All results</Select.Item>
									<Select.Item value="correct">Correct</Select.Item>
									<Select.Item value="incorrect">Incorrect</Select.Item>
								</Select.Content>
							</Select.Root>
						</label>
						<label class="space-y-1 text-xs">
							<span class="font-medium text-muted-foreground">Type</span>
							<Select.Root
								type="single"
								value={filters.kind || ALL_FILTER_VALUE}
								onValueChange={(value) =>
									applyFilter({
										...filters,
										kind: selectFilterValue(value) as KindFilter
									})}
							>
								<Select.Trigger class="h-8 w-full" aria-label="Question type">
									{filters.kind === 'mcq'
										? 'Multiple choice'
										: filters.kind === 'frq'
											? 'Written response'
											: filters.kind === 'quiz'
												? 'Graded quiz'
												: 'All types'}
								</Select.Trigger>
								<Select.Content>
									<Select.Item value={ALL_FILTER_VALUE}>All types</Select.Item>
									<Select.Item value="mcq">Multiple choice</Select.Item>
									<Select.Item value="frq">Written response</Select.Item>
									<Select.Item value="quiz">Graded quiz</Select.Item>
								</Select.Content>
							</Select.Root>
						</label>
						<label class="space-y-1 text-xs">
							<span class="font-medium text-muted-foreground">From</span>
							<input
								type="date"
								value={filters.from}
								onchange={(event) =>
									applyFilter({
										...filters,
										from: (event.currentTarget as HTMLInputElement).value
									})}
								class="h-8 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
							/>
						</label>
						<label class="space-y-1 text-xs">
							<span class="font-medium text-muted-foreground">To</span>
							<input
								type="date"
								value={filters.to}
								onchange={(event) =>
									applyFilter({ ...filters, to: (event.currentTarget as HTMLInputElement).value })}
								class="h-8 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
							/>
						</label>
					</div>
				</div>
			{/snippet}
		</HistoryDataTable>
	</div>
{/if}
