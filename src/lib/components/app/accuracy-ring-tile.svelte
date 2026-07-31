<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import { cn } from '$lib/utils.js';
	import { appSurfaceClass } from '$lib/components/app/surface.js';

	let {
		accuracy = 0,
		label = 'Accuracy',
		hint = 'Overall',
		class: className = ''
	}: {
		accuracy?: number;
		label?: string;
		hint?: string;
		class?: string;
	} = $props();

	const clamped = $derived(Math.max(0, Math.min(100, Math.round(accuracy))));
	const ringStyle = $derived(
		`background: conic-gradient(var(--primary) ${clamped * 3.6}deg, var(--muted) 0)`
	);
</script>

<Card.Root class={cn(appSurfaceClass, 'p-4', className)}>
	<div class="flex items-center gap-4">
		<div
			class="relative flex size-16 shrink-0 items-center justify-center rounded-full"
			style={ringStyle}
			role="img"
			aria-label="{clamped}% {label.toLowerCase()}"
		>
			<div
				class="flex size-12 items-center justify-center rounded-full bg-card text-sm font-semibold tabular-nums"
			>
				{clamped}%
			</div>
		</div>
		<div class="min-w-0">
			<p class="text-sm font-medium">{label}</p>
			<p class="text-xs text-muted-foreground">{hint}</p>
		</div>
	</div>
</Card.Root>
