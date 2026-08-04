<script lang="ts">
	import { resolve } from '$app/paths';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import EmptyState from '$lib/components/app/empty-state.svelte';
	import type { StatsData } from '$lib/users/types.js';
	import { onboardingSubjects } from '$lib/onboarding-subjects.js';
	import lightbulbImage from '$lib/assets/lightbulb.png';

	let { data } = $props();

	const firstName = $derived.by(() => {
		const name = data.user.name?.trim();
		if (!name) return 'Student';
		return name.split(' ')[0] || 'Student';
	});

	const statsData = $derived(data.stats as StatsData);
	const subjectMeta = new Map(onboardingSubjects.map((subject) => [subject.name, subject]));
	const subjectCards = $derived.by(() =>
		(data.selectedSubjects as string[])
			.map((name) => {
				const subject = subjectMeta.get(name);
				if (!subject) return null;

				const stats = statsData.subjectBreakdown.find((entry) => entry.subject === name);
				const questions = stats?.total ?? 0;
				const frqAttempts = stats?.frqAttempts ?? 0;

				return {
					...subject,
					questions,
					accuracy: stats?.accuracy ?? 0,
					frqAttempts,
					hasActivity: questions > 0 || frqAttempts > 0,
					frqAverage: stats?.frqAveragePercentage ?? 0,
					href: `${resolve('/app/practice')}?apClass=${encodeURIComponent(name)}`
				};
			})
			.filter((subject): subject is NonNullable<typeof subject> => subject !== null)
	);
</script>

<svelte:head>
	<title>Dashboard – Free AP Practice</title>
</svelte:head>

<div class="mx-auto w-full max-w-6xl space-y-8 px-5 py-10 sm:px-8 sm:py-12 lg:px-10">
	<header class="space-y-2">
		<h1
			class="ph-mask-pii font-display text-3xl leading-[1.12] font-medium tracking-tight text-balance sm:text-4xl"
		>
			Welcome back, {firstName}
		</h1>
		<p class="text-base leading-7 text-muted-foreground">
			Pick up where you left off, or check how you're doing.
		</p>
	</header>

	{#if subjectCards.length > 0}
		<section class="space-y-4" aria-labelledby="your-subjects">
			<div class="flex items-center justify-between gap-4">
				<h2 id="your-subjects" class="text-lg font-semibold tracking-tight">Your subjects</h2>
				<a
					href={resolve('/app/settings#practice')}
					class="text-sm font-medium text-primary underline-offset-4 hover:underline"
				>
					Manage subjects
				</a>
			</div>

			<div class="grid gap-4 md:grid-cols-2">
				{#each subjectCards as subject (subject.name)}
					{@const SubjectIcon = subject.icon}
					<Card.Root class="rounded-2xl border border-border/60 shadow-sm ring-0">
						<div class="flex flex-col gap-5 p-5">
							<div class="flex items-center gap-3">
								<div
									class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
								>
									<SubjectIcon class="size-5" />
								</div>
								<h3 class="min-w-0 flex-1 truncate font-medium">{subject.name}</h3>
								{#if !subject.hasActivity}
									<span
										class="inline-flex shrink-0 items-center rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
									>
										Not started
									</span>
								{/if}
							</div>

							{#if subject.hasActivity}
								<div class="space-y-2">
									<div class="flex items-center justify-between text-sm">
										<span class="text-muted-foreground">Progress</span>
										<span class="font-semibold tabular-nums">{subject.accuracy}%</span>
									</div>
									<div class="h-2 overflow-hidden rounded-full bg-muted">
										<div
											class="h-full rounded-full bg-primary transition-all"
											style="width: {subject.accuracy}%"
										></div>
									</div>
								</div>
								<div class="grid grid-cols-2 gap-3 text-sm">
									{#if subject.questions > 0}
										<div class="rounded-lg bg-muted/50 px-3 py-2">
											<p class="font-semibold tabular-nums">{subject.questions}</p>
											<p class="text-xs text-muted-foreground">questions</p>
										</div>
									{/if}
									{#if subject.frqAttempts > 0}
										<div class="rounded-lg bg-muted/50 px-3 py-2">
											<p class="font-semibold tabular-nums">{subject.frqAverage}%</p>
											<p class="text-xs text-muted-foreground">FRQ average</p>
										</div>
									{/if}
								</div>
							{/if}

							<Button href={subject.href} variant="outline" class="self-start">
								Practice now
								<ArrowRightIcon class="size-4" />
							</Button>
						</div>
					</Card.Root>
				{/each}
			</div>
		</section>
	{:else}
		<EmptyState
			title="No subjects selected yet"
			description="Choose the subjects you want to see on your dashboard."
			imageUrl={lightbulbImage}
		>
			<Button href={resolve('/app/onboarding?reset=1')} variant="outline">Choose subjects</Button>
		</EmptyState>
	{/if}
</div>
