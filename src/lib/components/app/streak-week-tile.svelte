<script lang="ts">
	import FlameIcon from '@lucide/svelte/icons/flame';
	import * as Card from '$lib/components/ui/card/index.js';
	import { cn } from '$lib/utils.js';
	import { appSurfaceClass } from '$lib/components/app/surface.js';

	const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

	let {
		activityLast7Days,
		currentStreak = 0,
		class: className = ''
	}: {
		/** Oldest → newest, length 7. */
		activityLast7Days: boolean[];
		currentStreak?: number;
		class?: string;
	} = $props();

	/** Map Mon→Sun labels onto the rolling last-7-days window ending today. */
	const days = $derived.by(() => {
		const today = new Date();
		const todayIndex = (today.getDay() + 6) % 7; // Mon=0 … Sun=6
		return Array.from({ length: 7 }, (_, i) => {
			const labelIndex = (todayIndex - 6 + i + 70) % 7;
			return {
				label: DAY_LABELS[labelIndex],
				active: Boolean(activityLast7Days[i])
			};
		});
	});
</script>

<Card.Root class={cn(appSurfaceClass, 'p-4', className)}>
	<div class="mb-3 flex items-center justify-between gap-2">
		<div>
			<p class="text-2xl font-semibold tracking-tight tabular-nums">{currentStreak}</p>
			<p class="text-xs text-muted-foreground">Day streak</p>
		</div>
		<div
			class="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400"
		>
			<FlameIcon class="size-4" />
		</div>
	</div>
	<div class="flex items-end justify-between gap-1">
		{#each days as day, i (i)}
			<div class="flex flex-1 flex-col items-center gap-1.5">
				<div
					class={cn(
						'flex size-7 items-center justify-center rounded-full text-[10px]',
						day.active
							? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
							: 'bg-muted text-muted-foreground'
					)}
					aria-label="{day.label}: {day.active ? 'practiced' : 'no practice'}"
				>
					{#if day.active}
						<FlameIcon class="size-3.5" />
					{/if}
				</div>
				<span class="text-[10px] font-medium text-muted-foreground">{day.label}</span>
			</div>
		{/each}
	</div>
</Card.Root>
