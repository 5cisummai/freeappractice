<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import EmptyState from '#lib/components/app/empty-state.svelte';
	import QuestionCardSkeleton from '#lib/components/questions/question-card-skeleton.svelte';
	import { cn } from '#lib/utils.js';
	import type { createWorkPracticeCore } from '#lib/components/ap-art-history/work-practice-core.svelte.js';

	const lightbulbImage = '/illustrations/lightbulb.png';

	type WorkPracticeCore = ReturnType<typeof createWorkPracticeCore>;

	let {
		core,
		class: className
	}: {
		core: WorkPracticeCore;
		class?: string;
	} = $props();

	function updateInput(field: keyof typeof core.inputs, value: string): void {
		core.inputs = { ...core.inputs, [field]: value };
	}

	function contentAreaLabel(value: string): string {
		const match = value.match(/^\d+\.\s*(.+)$/);
		return match?.[1]?.trim() ?? value;
	}

	function isPdfImageSource(url: string): boolean {
		try {
			return new URL(url).pathname.toLowerCase().endsWith('.pdf');
		} catch {
			return url.toLowerCase().includes('.pdf');
		}
	}
</script>

{#if core.isLoading}
	<QuestionCardSkeleton class={className} />
{:else if core.showEmptyState}
	<EmptyState
		title="Ready When You Are"
		description="Select a content area, then start practicing."
		imageUrl={lightbulbImage}
	/>
{:else if core.showErrorState}
	<Card.Root class={cn('relative overflow-visible bg-transparent shadow-none ring-0', className)}>
		<Card.Content
			class="relative flex min-h-40 flex-col items-center justify-center gap-3 px-6 pb-12 text-center"
		>
			<p class="text-lg font-medium text-muted-foreground sm:text-xl">We couldn’t load this work</p>
			<p class="max-w-sm text-sm text-muted-foreground/80">
				{core.statusMessage || 'Please try again in a moment.'}
			</p>
			<Button onclick={() => void core.retryLoad()} disabled={core.isLoading}>Try again</Button>
		</Card.Content>
	</Card.Root>
{:else if core.showWorkCard && core.work}
	<Card.Root
		class={cn(
			'relative overflow-visible bg-card pt-6 shadow-xs ring-1 ring-foreground/10',
			className
		)}
	>
		<Card.Content class="flex flex-col gap-6 pt-0 pb-6">
			<div class="flex flex-col gap-2">
				<h2 class="text-xl font-semibold">Work #{core.work.number}</h2>
				<p class="text-sm text-muted-foreground">{contentAreaLabel(core.work.contentArea)}</p>
			</div>

			<figure class="overflow-hidden rounded-xl border border-border/70 bg-muted/20">
				{#key core.work.number}
					{#if isPdfImageSource(core.work.imageSource)}
						<iframe
							src={core.work.imageSource}
							title="Official CED image for work {core.work.number}"
							class="block h-[min(28rem,70vh)] w-full bg-background"
						></iframe>
					{:else}
						<img
							src={core.work.imageSource}
							alt="Official image for work {core.work.number}"
							class="mx-auto max-h-[min(28rem,70vh)] w-full object-contain"
							loading="lazy"
							decoding="async"
						/>
					{/if}
				{/key}
				<figcaption
					class="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-4 py-2 text-xs text-muted-foreground"
				>
					<span>College Board official image set</span>
					<a
						href={core.work.collegeBoardSource}
						target="_blank"
						rel="noopener noreferrer"
						class="font-medium text-foreground underline-offset-4 hover:underline"
					>
						CED identifier
					</a>
				</figcaption>
			</figure>

			<div class="grid gap-4 sm:grid-cols-2">
				<div class="space-y-2 sm:col-span-2">
					<Label for="apah-title">Title</Label>
					<Input
						id="apah-title"
						value={core.inputs.title}
						disabled={core.hasChecked}
						oninput={(event) => updateInput('title', event.currentTarget.value)}
						placeholder="Work title"
						autocomplete="off"
					/>
				</div>
				<div class="space-y-2 sm:col-span-2">
					<Label for="apah-artist-location">Artist / location</Label>
					<Input
						id="apah-artist-location"
						value={core.inputs.artistLocation}
						disabled={core.hasChecked}
						oninput={(event) => updateInput('artistLocation', event.currentTarget.value)}
						placeholder="Artist or location credit"
						autocomplete="off"
					/>
				</div>
				<div class="space-y-2">
					<Label for="apah-date">Date</Label>
					<Input
						id="apah-date"
						value={core.inputs.date}
						disabled={core.hasChecked}
						oninput={(event) => updateInput('date', event.currentTarget.value)}
						placeholder="Date of creation"
						autocomplete="off"
					/>
				</div>
				<div class="space-y-2">
					<Label for="apah-medium">Medium</Label>
					<Input
						id="apah-medium"
						value={core.inputs.medium}
						disabled={core.hasChecked}
						oninput={(event) => updateInput('medium', event.currentTarget.value)}
						placeholder="Materials / medium"
						autocomplete="off"
					/>
				</div>
			</div>

			{#if core.hasChecked && core.gradeResult}
				<ul class="space-y-2 rounded-xl border border-border/70 bg-muted/20 p-4 text-sm">
					{#each core.gradeResult.fields as field (field.key)}
						<li class="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between">
							<span class="font-medium">{field.label}</span>
							<span
								class={cn(
									'text-muted-foreground',
									field.correct ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
								)}
							>
								{field.correct ? 'Correct' : 'Incorrect'} — {field.expectedDisplay}
							</span>
						</li>
					{/each}
				</ul>
			{/if}

			<div class="flex flex-wrap gap-3">
				{#if !core.hasChecked}
					<Button onclick={() => core.checkAnswers()}>Check</Button>
				{:else}
					<Button onclick={() => void core.loadNextWork()}>Next work</Button>
				{/if}
			</div>
		</Card.Content>
	</Card.Root>
{/if}
