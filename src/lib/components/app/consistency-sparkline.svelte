<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import { cn } from '$lib/utils.js';
	import { appSurfaceClass } from '$lib/components/app/surface.js';

	let {
		values,
		title = 'Consistency',
		hint = 'Questions per day · last 7 days',
		class: className = ''
	}: {
		/** Oldest → newest */
		values: number[];
		title?: string;
		hint?: string;
		class?: string;
	} = $props();

	const points = $derived.by(() => {
		const max = Math.max(...values, 1);
		const w = 120;
		const h = 40;
		const pad = 2;
		if (values.length === 0) return '';
		return values
			.map((v, i) => {
				const x = pad + (i / Math.max(values.length - 1, 1)) * (w - pad * 2);
				const y = h - pad - (v / max) * (h - pad * 2);
				return `${x},${y}`;
			})
			.join(' ');
	});
</script>

<Card.Root class={cn(appSurfaceClass, className)}>
	<Card.Header class="pb-2">
		<Card.Title class="text-base font-semibold tracking-tight">{title}</Card.Title>
		<Card.Description>{hint}</Card.Description>
	</Card.Header>
	<Card.Content class="pt-0">
		<svg viewBox="0 0 120 40" class="h-12 w-full text-primary" aria-hidden="true">
			<polyline
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				points={points}
			/>
		</svg>
	</Card.Content>
</Card.Root>
