<script lang="ts">
	import { resolve } from '$app/paths';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import PartyPopperIcon from '@lucide/svelte/icons/party-popper';
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
	const hasActivity = $derived(
		(statsData?.overview.totalQuestions ?? 0) > 0 || (statsData?.overview.frqSubmissions ?? 0) > 0
	);

	const subjectMeta = new Map(onboardingSubjects.map((subject) => [subject.name, subject]));
	const subjectCards = $derived.by(() =>
		(data.selectedSubjects as string[])
			.map((name) => {
				const subject = subjectMeta.get(name);
				if (!subject) return null;

				return {
					...subject,
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
			{#if hasActivity}
				Welcome back, {firstName}
			{:else}
				Welcome, {firstName}!
			{/if}
		</h1>
		<p class="text-base leading-7 text-muted-foreground">
			{#if hasActivity}
				Pick up where you left off, or check how you're doing.
			{:else}
				You're all set. Your subjects are ready.
			{/if}
		</p>
	</header>

	{#if subjectCards.length > 0}
		<section
			class="rounded-2xl border border-primary/25 bg-primary/5 p-5 sm:p-6"
			aria-labelledby="get-started-heading"
		>
			<div class="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
				<div class="flex gap-4">
					<div
						class="flex size-12 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-background"
					>
						<PartyPopperIcon class="size-6 text-primary" aria-hidden="true" />
					</div>
					<div class="space-y-1">
						<h2 id="get-started-heading" class="font-semibold tracking-tight">Let's get started</h2>
						<p class="text-sm leading-6 text-muted-foreground">
							Choose a subject and answer a few questions. No diagnostic or setup required.
						</p>
					</div>
				</div>
				<Button href={resolve('/app/practice')} class="shrink-0 self-center sm:self-auto">
					Start practicing
					<ArrowRightIcon class="size-4" aria-hidden="true" />
				</Button>
			</div>
		</section>

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

			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each subjectCards as subject (subject.name)}
					{@const SubjectIcon = subject.icon}
					<Card.Root class="rounded-2xl border border-border/60 shadow-sm ring-0">
						<div class="flex flex-col gap-4 p-5">
							<div class="flex items-start gap-3">
								<div
									class="flex size-10 shrink-0 items-center justify-center rounded-lg {subject.iconClass}"
								>
									<SubjectIcon class="size-5" />
								</div>
								<div class="min-w-0 space-y-1">
									<h3 class="font-semibold leading-snug">{subject.name}</h3>
									<p class="text-sm leading-6 text-muted-foreground">{subject.description}</p>
								</div>
							</div>

							<a
								href={subject.href}
								class="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
							>
								Start practicing
								<ArrowRightIcon class="size-4" aria-hidden="true" />
							</a>
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
