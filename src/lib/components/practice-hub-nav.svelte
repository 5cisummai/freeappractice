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
		getParentUnitPageForTopic,
		getTopicPagesForClass,
		getUnitPagesForClass
	} from '$lib/catalog/practice-pages.js';

	let { page }: { page: PracticePage } = $props();

	const classPage = $derived(getClassPracticePageFor(page));
	const unitPages = $derived(getUnitPagesForClass(page.className));
	const topicPages = $derived(getTopicPagesForClass(page.className));
	const adjacentUnits = $derived(getAdjacentUnitPages(page));
	const parentUnit = $derived(getParentUnitPageForTopic(page));

	const siblingTopics = $derived(
		page.type === 'topic'
			? topicPages.filter((topic) => topic.slug !== page.slug)
			: []
	);
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

		{#if topicPages.length > 0}
			<section>
				<h2 class="mb-3 text-sm font-semibold tracking-wide text-foreground uppercase">
					Featured topics
				</h2>
				<ul class="grid gap-2 sm:grid-cols-2">
					{#each topicPages as topicPage (topicPage.slug)}
						<li>
							<a
								href={resolve(`/practice/${topicPage.slug}`)}
								class="group flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/40"
							>
								<span class="text-sm font-medium group-hover:text-primary">
									{formatUnitLabel(topicPage)}
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

		{#if topicPages.length > 0}
			<section>
				<h2 class="mb-3 text-sm font-semibold tracking-wide text-foreground uppercase">
					Related topics
				</h2>
				<ul class="flex flex-wrap gap-2">
					{#each topicPages as topicPage (topicPage.slug)}
						<li>
							<a
								href={resolve(`/practice/${topicPage.slug}`)}
								class="inline-flex rounded-full border border-border px-3 py-1.5 text-sm transition-colors hover:bg-muted/40"
							>
								{formatUnitLabel(topicPage)}
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	{/if}

	{#if page.type === 'topic'}
		{#if parentUnit}
			<section>
				<h2 class="mb-3 text-sm font-semibold tracking-wide text-foreground uppercase">
					Related unit
				</h2>
				<a
					href={resolve(`/practice/${parentUnit.slug}`)}
					class="group inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium transition-colors hover:bg-muted/40"
				>
					{formatUnitLabel(parentUnit)}
					<ArrowRightIcon class="size-4 text-muted-foreground group-hover:text-primary" />
				</a>
			</section>
		{/if}

		{#if siblingTopics.length > 0}
			<section>
				<h2 class="mb-3 text-sm font-semibold tracking-wide text-foreground uppercase">
					More {page.className} topics
				</h2>
				<ul class="flex flex-wrap gap-2">
					{#each siblingTopics as topicPage (topicPage.slug)}
						<li>
							<a
								href={resolve(`/practice/${topicPage.slug}`)}
								class="inline-flex rounded-full border border-border px-3 py-1.5 text-sm transition-colors hover:bg-muted/40"
							>
								{formatUnitLabel(topicPage)}
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
