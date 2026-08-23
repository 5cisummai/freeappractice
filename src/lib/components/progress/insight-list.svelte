<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import type { InsightItem } from './progress-insights.js';

	let {
		title,
		items,
		empty
	}: {
		title: string;
		items: InsightItem[];
		empty: string;
	} = $props();

	function insightHref(href: string): string {
		if (!href.startsWith('/app/practice')) return href;
		return `${resolve('/app/practice')}${href.slice('/app/practice'.length)}`;
	}
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>{title}</Card.Title>
	</Card.Header>
	<Card.Content>
		{#if items.length === 0}
			<p class="text-sm text-muted-foreground">{empty}</p>
		{:else}
			<ul class="flex flex-col gap-2">
				{#each items as item (item.id)}
					<li>
						{#if item.href}
							<Button
								href={insightHref(item.href)}
								variant="ghost"
								class="h-auto w-full flex-col items-start gap-0.5 px-3 py-2 whitespace-normal"
							>
								<span class="text-sm font-medium">{item.title}</span>
								<span class="text-xs font-normal text-muted-foreground">{item.detail}</span>
							</Button>
						{:else}
							<div class="flex flex-col gap-0.5 rounded-lg px-3 py-2">
								<span class="text-sm font-medium">{item.title}</span>
								<span class="text-xs text-muted-foreground">{item.detail}</span>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</Card.Content>
</Card.Root>
