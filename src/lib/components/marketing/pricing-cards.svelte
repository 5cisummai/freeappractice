<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import CheckIcon from '@tabler/icons-svelte/icons/check-filled';
	import ArrowRightIcon from '@tabler/icons-svelte/icons/arrow-right';
	import { Button } from '$lib/components/ui/button/index.js';

	let {
		freeAction,
		superAction,
		freeBadge,
		superBadge
	}: {
		freeAction?: Snippet;
		superAction?: Snippet;
		freeBadge?: Snippet;
		superBadge?: Snippet;
	} = $props();

	const freeFeatures = [
		'Unlimited AP multiple-choice practice',
		'Instant explanations, progress, history, and bookmarks',
		'Written-response practice and the standard AI tutor'
	];
	const superFeatures = [
		'Everything in Free',
		'Personalized MCQ and FRQ tutoring',
		'AI Coach with weekly study plans you approve',
		'Weekly study plans you approve with Coach',
		'600 personalized tutor messages per month'
	];
</script>

<div class="mx-auto grid max-w-4xl gap-5 md:grid-cols-2">
	<article class="flex flex-col rounded-3xl border border-border bg-card p-7 marketing-card-shadow">
		<div class="flex items-start justify-between gap-3">
			<div>
				<p class="text-sm font-semibold text-muted-foreground">Free</p>
				<h3 class="mt-2 font-display text-3xl font-medium">$0</h3>
			</div>
			{#if freeBadge}
				{@render freeBadge()}
			{/if}
		</div>
		<p class="mt-1 text-sm text-muted-foreground">Always available</p>
		<ul class="mt-7 flex-1 space-y-3 text-sm">
			{#each freeFeatures as feature (feature)}
				<li class="flex gap-2">
					<CheckIcon class="mt-0.5 size-4 shrink-0 text-primary" />{feature}
				</li>
			{/each}
		</ul>
		{#if freeAction}
			{@render freeAction()}
		{:else}
			<Button href={resolve('/app/practice')} variant="outline" class="mt-8 w-full">
				Keep practicing free
			</Button>
		{/if}
	</article>

	<article
		class="flex flex-col rounded-3xl border-2 border-violet-300/50 super-tier-gradient p-7 marketing-card-shadow shadow-violet-500/10"
	>
		<div class="flex items-start justify-between gap-3">
			<div>
				<p class="text-sm font-semibold text-primary">Super</p>
				<h3 class="mt-2 font-display text-3xl font-medium">
					$9 <span class="text-base text-muted-foreground">/ month</span>
				</h3>
			</div>
			{#if superBadge}
				{@render superBadge()}
			{:else}
				<span
					class="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground"
				>
					Best value yearly
				</span>
			{/if}
		</div>
		<p class="mt-1 text-sm text-muted-foreground">or $79 yearly</p>
		<ul class="mt-7 flex-1 space-y-3 text-sm">
			{#each superFeatures as feature (feature)}
				<li class="flex gap-2">
					<CheckIcon class="mt-0.5 size-4 shrink-0 text-primary" />{feature}
				</li>
			{/each}
		</ul>
		{#if superAction}
			{@render superAction()}
		{:else}
			<Button href={resolve('/app/super/setup')} class="mt-8 w-full">
				Choose Super <ArrowRightIcon class="size-4" />
			</Button>
		{/if}
	</article>
</div>
