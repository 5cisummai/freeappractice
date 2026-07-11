<script lang="ts">
	import { resolve } from '$app/paths';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import type { PracticePage } from '$lib/catalog/practice-pages.js';
	import {
		formatUnitLabel,
		getAdjacentUnitPages,
		getClassPracticePageFor,
		getUnitPagesForClass
	} from '$lib/catalog/practice-pages.js';

	let { page }: { page: PracticePage } = $props();

	const classPage = $derived(getClassPracticePageFor(page));
	const unitPages = $derived(getUnitPagesForClass(page.className));
	const adjacentUnits = $derived(getAdjacentUnitPages(page));
</script>

<nav class="space-y-8" aria-label="Practice hub navigation">
	{#if page.type === 'class'}
		{#if unitPages.length > 0}
			<section>
				<h2 class="mb-3 text-sm font-semibold tracking-wide text-foreground uppercase">
					Units in {page.className}
				</h2>
				<ul class="grid gap-2 sm:grid-cols-2">
					{#each unitPages as unitPage (unitPage.slug)}
						<li>
							<a
								href={resolve(`/practice/${unitPage.slug}`)}
								class="group flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/40"
							>
								<span class="text-sm font-medium group-hover:text-primary">
									{formatUnitLabel(unitPage)}
								</span>
								<ArrowRightIcon
									class="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
								/>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	{/if}

	{#if page.type === 'unit'}
		{#if adjacentUnits.prev || adjacentUnits.next}
			<section class="flex flex-wrap gap-3">
				{#if adjacentUnits.prev}
					<a
						href={resolve(`/practice/${adjacentUnits.prev.slug}`)}
						class="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm transition-colors hover:bg-muted/40"
					>
						<ChevronLeftIcon class="size-4" />
						{formatUnitLabel(adjacentUnits.prev)}
					</a>
				{/if}
				{#if adjacentUnits.next}
					<a
						href={resolve(`/practice/${adjacentUnits.next.slug}`)}
						class="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm transition-colors hover:bg-muted/40"
					>
						{formatUnitLabel(adjacentUnits.next)}
						<ChevronRightIcon class="size-4" />
					</a>
				{/if}
			</section>
		{/if}

		{#if unitPages.length > 0}
			<section>
				<h2 class="mb-3 text-sm font-semibold tracking-wide text-foreground uppercase">
					All units in {page.className}
				</h2>
				<ul class="grid gap-2 sm:grid-cols-2">
					{#each unitPages as unitPage (unitPage.slug)}
						<li>
							<a
								href={resolve(`/practice/${unitPage.slug}`)}
								class="group flex items-center justify-between rounded-xl border px-4 py-3 transition-colors {unitPage.slug ===
								page.slug
									? 'border-primary/50 bg-primary/5'
									: 'border-border bg-card hover:bg-muted/40'}"
								aria-current={unitPage.slug === page.slug ? 'page' : undefined}
							>
								<span class="text-sm font-medium group-hover:text-primary">
									{formatUnitLabel(unitPage)}
								</span>
								<ArrowRightIcon class="size-4 shrink-0 text-muted-foreground" />
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	{/if}

	{#if classPage && page.type !== 'class'}
		<section>
			<a
				href={resolve(`/practice/${classPage.slug}`)}
				class="inline-flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline"
			>
				All {page.className} practice
				<ArrowRightIcon class="size-4" />
			</a>
		</section>
	{/if}
</nav>
