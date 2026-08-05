<script lang="ts">
	import { resolve } from '$app/paths';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import FlameIcon from '@lucide/svelte/icons/flame';
	import { Button } from '$lib/components/ui/button/index.js';
	import EmptyState from '$lib/components/app/empty-state.svelte';
	import PageShell from '$lib/components/layout/page-shell.svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import type { ProgressEntry, StatsData } from '$lib/users/types.js';
	import { onboardingSubjects } from '$lib/onboarding-subjects.js';
	import lightbulbImage from '$lib/assets/lightbulb.png';

	const SUBJECT_PROGRESS_GOAL = 100;

	let { data } = $props();

	const firstName = $derived.by(() => {
		const name = data.user.name?.trim();
		if (!name) return 'Student';
		return name.split(' ')[0] || 'Student';
	});

	const statsData = $derived(data.stats as StatsData);
	const progressData = $derived(data.progress as ProgressEntry[]);
	const superEntitlements = $derived(data.entitlements);
	const superPlan = $derived(data.superPlan);
	const streak = $derived(statsData?.overview.currentStreak ?? 0);
	const hasActivity = $derived(
		(statsData?.overview.totalQuestions ?? 0) > 0 || (statsData?.overview.frqSubmissions ?? 0) > 0
	);

	const answeredBySubject = $derived(
		new Map(statsData.subjectBreakdown.map((entry) => [entry.subject, entry.total]))
	);

	const lastMcqAtBySubject = $derived.by(() => {
		const map = new Map<string, string>();
		for (const entry of progressData) {
			if (!entry.lastAttemptAt) continue;
			const current = map.get(entry.apClass);
			if (!current || entry.lastAttemptAt > current) {
				map.set(entry.apClass, entry.lastAttemptAt);
			}
		}
		return map;
	});

	const subjectMeta = new Map(onboardingSubjects.map((subject) => [subject.name, subject]));

	const subjectCards = $derived.by(() =>
		(data.selectedSubjects as string[])
			.map((name) => {
				const subject = subjectMeta.get(name);
				if (!subject) return null;

				const answered = answeredBySubject.get(name) ?? 0;
				const shown = Math.min(answered, SUBJECT_PROGRESS_GOAL);
				const percent = Math.min(
					Math.floor((answered / SUBJECT_PROGRESS_GOAL) * 100),
					SUBJECT_PROGRESS_GOAL
				);
				const lastPracticedAt = lastMcqAtBySubject.get(name) ?? null;

				return {
					...subject,
					answered,
					shown,
					percent,
					lastPracticedAt,
					href: `${resolve('/app/practice')}?apClass=${encodeURIComponent(name)}`
				};
			})
			.filter((subject): subject is NonNullable<typeof subject> => subject !== null)
	);

	const recommendation = $derived.by(() => {
		if (subjectCards.length === 0) return null;

		let best = subjectCards[0];
		for (const subject of subjectCards) {
			if (!subject.lastPracticedAt) continue;
			if (!best.lastPracticedAt || subject.lastPracticedAt > best.lastPracticedAt) {
				best = subject;
			}
		}
		return best;
	});

	const shellTitle = $derived(
		hasActivity ? `Welcome back, ${firstName}` : `Welcome, ${firstName}!`
	);
	const shellDescription = $derived(
		hasActivity ? "Let's keep your momentum going." : "You're all set. Your subjects are ready."
	);

	function formatLastPracticed(iso: string | null): string {
		if (!iso) return 'Never';
		const date = new Date(iso);
		if (Number.isNaN(date.getTime())) return 'Never';

		const now = new Date();
		const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
		const diffDays = Math.round((startOfToday.getTime() - startOfDay.getTime()) / 86_400_000);

		if (diffDays <= 0) return 'Today';
		if (diffDays === 1) return 'Yesterday';
		if (diffDays < 30) return `${diffDays} days ago`;
		return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
	}

	function progressBarClass(iconClass: string): string {
		if (iconClass.includes('sky')) return 'bg-sky-500';
		if (iconClass.includes('emerald')) return 'bg-emerald-500';
		if (iconClass.includes('violet')) return 'bg-violet-500';
		if (iconClass.includes('indigo')) return 'bg-indigo-500';
		if (iconClass.includes('cyan')) return 'bg-cyan-500';
		if (iconClass.includes('purple')) return 'bg-purple-500';
		if (iconClass.includes('amber')) return 'bg-amber-500';
		if (iconClass.includes('teal')) return 'bg-teal-500';
		if (iconClass.includes('rose')) return 'bg-rose-500';
		if (iconClass.includes('orange')) return 'bg-orange-500';
		if (iconClass.includes('blue')) return 'bg-blue-500';
		return 'bg-primary';
	}
</script>

<svelte:head>
	<title>Dashboard – Free AP Practice</title>
</svelte:head>

<PageShell title={shellTitle} description={shellDescription} maskTitle>
	{#snippet actions()}
		<div
			class="flex items-center gap-1.5 px-2 text-orange-500"
			aria-label="{streak} day streak"
			title="Day streak"
		>
			<FlameIcon class="size-5 shrink-0" aria-hidden="true" />
			<span class="text-lg font-semibold tracking-tight tabular-nums">{streak}</span>
		</div>
	{/snippet}

	{#if subjectCards.length > 0 && recommendation}
		{@const RecIcon = recommendation.icon}
		{@const hasPracticedRecommendation = Boolean(recommendation.lastPracticedAt)}
		<section
			class="rounded-2xl border border-primary/25 bg-primary/5 p-5 sm:p-6"
			aria-labelledby="recommendation-heading"
		>
			<div class="flex items-start justify-between gap-4">
				<div class="min-w-0 flex-1 space-y-4">
					<div class="space-y-1">
						<h2
							id="recommendation-heading"
							class="font-display text-xl font-medium tracking-tight sm:text-2xl"
						>
							{recommendation.name}
						</h2>
						<p class="text-sm text-muted-foreground">
							{hasPracticedRecommendation
								? 'Continue where you left off'
								: 'Start with a few questions'}
						</p>
					</div>

					<div class="space-y-2">
						<p class="text-sm text-muted-foreground">
							{recommendation.percent}% complete · {recommendation.shown} / {SUBJECT_PROGRESS_GOAL}
							questions
						</p>
						<div
							class="h-2 w-full max-w-md overflow-hidden rounded-full bg-muted"
							role="progressbar"
							aria-valuenow={recommendation.percent}
							aria-valuemin={0}
							aria-valuemax={100}
							aria-label={`${recommendation.name} progress`}
						>
							<div
								class="h-full rounded-full bg-primary transition-all"
								style:width="{recommendation.percent}%"
							></div>
						</div>
					</div>

					<Button href={recommendation.href}>
						{hasPracticedRecommendation ? 'Continue practicing' : 'Start practicing'}
						<ArrowRightIcon class="size-4" aria-hidden="true" />
					</Button>
				</div>

				<div
					class="hidden size-12 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-background sm:flex"
					aria-hidden="true"
				>
					<RecIcon class="size-6 text-primary" />
				</div>
			</div>
		</section>

		{#if superEntitlements?.plan === 'super'}
			<div class="grid gap-3 sm:grid-cols-2">
				<a
					href={resolve('/app/coach')}
					class="group flex items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-5 py-4 shadow-sm transition-colors hover:bg-primary/10"
				>
					<div>
						<p class="font-medium">Coach</p>
						<p class="text-sm text-muted-foreground">
							Turn your progress into a practical next step.
						</p>
					</div>
					<ArrowRightIcon class="size-4 shrink-0 text-primary" />
				</a>
				<a
					href={resolve('/app/insights')}
					class="group flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card px-5 py-4 shadow-sm transition-colors hover:bg-muted/40"
				>
					<div>
						<p class="font-medium">Weekly study plan</p>
						<p class="text-sm text-muted-foreground">
							{superPlan?.tasks.filter((task) => task.status !== 'done').length ?? 0} tasks remaining
						</p>
					</div>
					<ArrowRightIcon class="size-4 shrink-0 text-muted-foreground" />
				</a>
			</div>
		{:else}
			<a
				href={resolve('/pricing')}
				class="flex items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-primary/5 px-5 py-4 text-sm transition-colors hover:bg-primary/10"
			>
				<span
					><span class="font-medium">Super:</span> personalized tutoring, Coach, insights, and study
					plans.</span
				>
				<ArrowRightIcon class="size-4 shrink-0 text-primary" />
			</a>
		{/if}

		<section class="space-y-4" aria-labelledby="your-subjects">
			<div class="flex flex-wrap items-end justify-between gap-3">
				<h2 id="your-subjects" class="font-display text-xl font-medium tracking-tight sm:text-2xl">
					Your subjects
				</h2>
				<a
					href={resolve('/app/settings#practice')}
					class="text-sm font-medium text-primary underline-offset-4 hover:underline"
				>
					Manage subjects
				</a>
			</div>

			<Card.Root class="rounded-2xl border border-border/60 py-0 shadow-sm ring-0">
				<div class="divide-y divide-border/70">
					{#each subjectCards as subject (subject.name)}
						{@const SubjectIcon = subject.icon}
						{@const hasPracticed = Boolean(subject.lastPracticedAt)}
						<a
							href={subject.href}
							class="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/40"
						>
							<div
								class="flex size-10 shrink-0 items-center justify-center rounded-lg {subject.iconClass}"
							>
								<SubjectIcon class="size-5" />
							</div>

							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium">{subject.name}</p>
								<p class="text-xs text-muted-foreground sm:hidden">
									{#if hasPracticed}
										Last practiced {formatLastPracticed(subject.lastPracticedAt)}
									{:else}
										Get started
									{/if}
								</p>
							</div>

							{#if hasPracticed}
								<div class="flex w-36 items-center gap-3">
									<div
										class="h-2 flex-1 overflow-hidden rounded-full bg-muted"
										role="progressbar"
										aria-valuenow={subject.percent}
										aria-valuemin={0}
										aria-valuemax={100}
										aria-label={`${subject.name} progress`}
									>
										<div
											class="h-full rounded-full transition-all {progressBarClass(
												subject.iconClass
											)}"
											style:width="{subject.percent}%"
										></div>
									</div>
									<span class="w-10 text-right text-sm font-semibold tabular-nums">
										{subject.percent}%
									</span>
								</div>

								<div class="hidden w-28 shrink-0 text-right sm:block">
									<p class="text-xs text-muted-foreground">Last practiced</p>
									<p class="text-sm font-medium">{formatLastPracticed(subject.lastPracticedAt)}</p>
								</div>
							{:else}
								<p class="hidden text-sm font-medium text-muted-foreground sm:block">Get started</p>
							{/if}

							<ChevronRightIcon class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
						</a>
					{/each}
				</div>
			</Card.Root>
		</section>
	{:else}
		{#if superEntitlements?.plan !== 'super'}
			<a
				href={resolve('/pricing')}
				class="flex items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-primary/5 px-5 py-4 text-sm transition-colors hover:bg-primary/10"
			>
				<span
					><span class="font-medium">Super:</span> personalized tutoring, Coach, insights, and study
					plans.</span
				>
				<ArrowRightIcon class="size-4 shrink-0 text-primary" />
			</a>
		{/if}
		<EmptyState
			title="No subjects selected yet"
			description="Choose the subjects you want to see on your dashboard."
			imageUrl={lightbulbImage}
		>
			<Button href={resolve('/app/onboarding?reset=1')} variant="outline">Choose subjects</Button>
		</EmptyState>
	{/if}
</PageShell>
