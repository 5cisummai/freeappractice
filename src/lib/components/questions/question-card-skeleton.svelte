<script lang="ts">
	import { page } from '$app/state';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { cn } from '$lib/utils.js';

	const optionRows = [0, 1, 2, 3];

	let { class: className }: { class?: string } = $props();
	const isLandingPage = $derived(page.route.id === '/');
</script>

<Card.Root
	class={cn(
		'relative overflow-visible pt-6',
		isLandingPage
			? 'border-0 bg-transparent shadow-none ring-0'
			: 'bg-card shadow-xs ring-1 ring-foreground/10',
		className
	)}
	aria-busy="true"
	aria-label="Loading question"
>
	<Card.Content class="flex flex-col gap-6 pt-0 pb-0">
		<div class="flex items-start justify-between gap-4">
			<Skeleton class="mt-0.5 h-7 w-36" />
			<Skeleton class="size-8 shrink-0 rounded-md" />
		</div>

		<div class="space-y-2">
			<Skeleton class="h-4 w-full" />
			<Skeleton class="h-4 w-[94%]" />
			<Skeleton class="h-4 w-[72%]" />
		</div>

		<div class="space-y-2">
			{#each optionRows as row (row)}
				<div class="flex gap-3 rounded-lg border border-border/70 px-4 py-3">
					<Skeleton class="mt-0.5 size-6 shrink-0 rounded-full" />
					<Skeleton class="h-4 w-full self-center" />
				</div>
			{/each}
		</div>
	</Card.Content>

	<Card.Footer class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<div class="flex flex-wrap gap-2">
			<Skeleton class="h-8 w-12 rounded-md" />
			<Skeleton class="h-8 w-44 rounded-md" />
			<Skeleton class="h-8 w-28 rounded-md" />
		</div>
		<div class="flex gap-2">
			<Skeleton class="h-9 w-32 rounded-md" />
			<Skeleton class="h-9 w-28 rounded-md" />
		</div>
	</Card.Footer>
</Card.Root>
