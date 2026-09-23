<script lang="ts">
	import { resolve } from '$app/paths';
	import PageShell from '$lib/components/layout/page-shell.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';

	let { data } = $props();

	function formatDate(value: string | null): string {
		if (!value) return 'Date not available';
		const date = new Date(value);
		return Number.isFinite(date.getTime())
			? new Intl.DateTimeFormat(undefined, {
					month: 'short',
					day: 'numeric',
					year: 'numeric'
				}).format(date)
			: 'Date not available';
	}
</script>

<svelte:head>
	<title>Tutor memory | Free AP Practice</title>
</svelte:head>

<PageShell
	title="Tutor memory"
	description="Review the learning memories currently stored for your Tutor."
>
	<div class="space-y-5">
		<Button href={resolve('/app/settings#super')} variant="outline" size="sm">
			Back to settings
		</Button>

		{#if data.loadError}
			<Card.Root class="border-border/70 shadow-sm">
				<Card.Content class="p-5 text-sm text-muted-foreground" role="status">
					Your memories could not be loaded right now. Please try again later.
				</Card.Content>
			</Card.Root>
		{:else if data.memories.length}
			<p class="text-sm text-muted-foreground">
				{data.memories.length}
				{data.memories.length === 1 ? 'memory' : 'memories'} stored
			</p>
			<ul class="space-y-3">
				{#each data.memories as memory (memory.id)}
					<li>
						<Card.Root class="border-border/70 shadow-sm">
							<Card.Content class="space-y-3 p-5">
								<p class="ph-mask-pii text-sm leading-6 break-words whitespace-pre-wrap">
									{memory.text}
								</p>
								<time
									class="block text-xs text-muted-foreground"
									datetime={memory.createdAt ?? undefined}
								>
									Saved {formatDate(memory.createdAt)}
								</time>
							</Card.Content>
						</Card.Root>
					</li>
				{/each}
			</ul>
		{:else}
			<Card.Root class="border-border/70 shadow-sm">
				<Card.Content class="space-y-2 p-5">
					<p class="font-medium">No saved memories</p>
					<p class="text-sm text-muted-foreground">
						{data.memoryAvailable
							? 'Your Tutor has not stored any learning memories yet.'
							: 'Tutor memory is not available right now.'}
					</p>
				</Card.Content>
			</Card.Root>
		{/if}
	</div>
</PageShell>
