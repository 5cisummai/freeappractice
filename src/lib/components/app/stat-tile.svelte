<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import { cn } from '$lib/utils.js';
	import { appSurfaceClass } from '$lib/components/app/surface.js';

	let {
		label,
		value,
		hint,
		class: className = '',
		icon,
		children
	}: {
		label: string;
		value?: string | number;
		hint?: string;
		class?: string;
		icon?: Snippet;
		children?: Snippet;
	} = $props();
</script>

<Card.Root class={cn(appSurfaceClass, 'p-4', className)}>
	{#if children}
		{@render children()}
	{:else}
		<div class="flex items-start gap-3">
			{#if icon}
				<div
					class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
				>
					{@render icon()}
				</div>
			{/if}
			<div class="min-w-0 flex-1">
				{#if value !== undefined}
					<p class="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
				{/if}
				<p class="text-xs text-muted-foreground">{label}</p>
				{#if hint}
					<p class="mt-0.5 text-xs text-muted-foreground/80">{hint}</p>
				{/if}
			</div>
		</div>
	{/if}
</Card.Root>
