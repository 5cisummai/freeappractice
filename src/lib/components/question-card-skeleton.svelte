<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Resizable from '$lib/components/ui/resizable/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { cn } from '$lib/utils.js';

	type QuestionCardSkeletonProps = {
		class?: string;
		isTwoColumn?: boolean;
	};

	const optionRows = [0, 1, 2, 3];

	let { class: className, isTwoColumn = false }: QuestionCardSkeletonProps = $props();
</script>

<Card.Root class={cn('overflow-hidden border-border/70 shadow-sm', className)}>
	<Card.Header class="gap-3">
		<Skeleton class="h-6 w-40" />
		<Skeleton class="h-4 w-52" />
	</Card.Header>

	<Card.Content class="space-y-6">
		{#if isTwoColumn}
			<div class="h-80 overflow-hidden rounded-lg border border-border/70 bg-muted/15">
				<Resizable.PaneGroup direction="horizontal" class="h-full">
					<Resizable.Pane defaultSize={54} minSize={30} class="min-w-0">
						<div class="space-y-3 p-4 sm:p-5">
							<Skeleton class="h-4 w-24" />
							<Skeleton class="h-4 w-full" />
							<Skeleton class="h-4 w-[94%]" />
							<Skeleton class="h-4 w-[88%]" />
							<Skeleton class="h-4 w-[92%]" />
							<Skeleton class="h-4 w-[83%]" />
						</div>
					</Resizable.Pane>

					<Resizable.Handle withHandle />

					<Resizable.Pane defaultSize={46} minSize={30} class="min-w-0">
						<div class="space-y-3 p-4 sm:p-5">
							<Skeleton class="h-4 w-24" />
							<Skeleton class="h-4 w-full" />
							<Skeleton class="h-4 w-[95%]" />
							<Skeleton class="h-4 w-[90%]" />
						</div>
					</Resizable.Pane>
				</Resizable.PaneGroup>
			</div>
		{:else}
			<div class="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-4 sm:p-5">
				<Skeleton class="h-4 w-full" />
				<Skeleton class="h-4 w-[96%]" />
				<Skeleton class="h-4 w-[90%]" />
			</div>
		{/if}

		<Separator />

		<div class="space-y-3">
			{#each optionRows as row (row)}
				<div class="flex items-center gap-3 rounded-lg border border-border/70 p-4">
					<Skeleton class="size-6 rounded-full" />
					<Skeleton class="h-4 w-full" />
				</div>
			{/each}
		</div>
	</Card.Content>

	<Card.Footer
		class="flex flex-col gap-4 border-t border-border/70 bg-muted/20 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
	>
		<Skeleton class="h-4 w-full sm:w-72" />
		<div class="flex w-full gap-2 sm:w-auto">
			<Skeleton class="h-9 flex-1 sm:w-28" />
			<Skeleton class="h-9 flex-1 sm:w-32" />
		</div>
	</Card.Footer>
</Card.Root>
