<script lang="ts">
	import { resolve } from '$app/paths';
	import { SvelteMap } from 'svelte/reactivity';
	import ArrowRightIcon from '@tabler/icons-svelte/icons/arrow-right';
	import CalendarIcon from '@tabler/icons-svelte/icons/calendar-week-filled';
	import CheckIcon from '@tabler/icons-svelte/icons/check';
	import ChevronRightIcon from '@tabler/icons-svelte/icons/chevron-right';
	import ClockIcon from '@tabler/icons-svelte/icons/clock';
	import FlameIcon from '@tabler/icons-svelte/icons/flame-filled';
	import { Button } from '$lib/components/ui/button/index.js';
	import EmptyState from '$lib/components/app/empty-state.svelte';
	import FirstUseHint from '$lib/components/onboarding/first-use-hint.svelte';
	import OrgGroupDashboard from '$lib/components/layout/org-group-dashboard.svelte';
	import PageShell from '$lib/components/layout/page-shell.svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import type { StudyTask } from '$lib/super/types';
	import type { ProgressEntry, StatsData } from '$lib/users/types.js';
	import { onboardingSubjects } from '$lib/onboarding-subjects.js';
	const lightbulbImage = '/illustrations/lightbulb.png';

	const SUBJECT_PROGRESS_GOAL = 100;

	let { data } = $props();

	const firstName = $derived.by(() => {
		const name = data.user.name?.trim();
		if (!name) return 'Student';
		return name.split(' ')[0] || 'Student';
	});

	const statsData = $derived(data.stats as StatsData);
	const progressData = $derived((data.progress as ProgressEntry[] | undefined) ?? []);
	const planAccess = $derived(data.planAccess);
	const studyPlan = $derived(data.studyPlan);
	const canViewStudyPlan = $derived(data.canViewStudyPlan ?? false);
	const planTaskCount = $derived(studyPlan?.tasks.length ?? 0);
	const planCompletedCount = $derived(
		studyPlan?.tasks.filter((task) => task.status === 'done').length ?? 0
	);
	const firstIncompleteTaskId = $derived.by(() => {
		const tasks = [...(studyPlan?.tasks ?? [])].sort((a, b) => a.date.localeCompare(b.date));
		return tasks.find((task) => task.status === 'todo')?.id ?? null;
	});
	const compactPlanTasks = $derived.by(() => {
		const tasks = [...(studyPlan?.tasks ?? [])].sort((a, b) => a.date.localeCompare(b.date));
		const todos = tasks.filter((task) => task.status === 'todo');
		return todos.slice(0, 3);
	});
	const allPlanTasksComplete = $derived(planTaskCount > 0 && planCompletedCount === planTaskCount);
	const streak = $derived(statsData?.overview.currentStreak ?? 0);
	const hasActivity = $derived(
		(statsData?.overview.totalQuestions ?? 0) > 0 || (statsData?.overview.frqSubmissions ?? 0) > 0
	);

	const answeredBySubject = $derived(
		new Map((statsData?.subjectBreakdown ?? []).map((entry) => [entry.subject, entry.total]))
	);

	const lastMcqAtBySubject = $derived.by(() => {
		const map = new SvelteMap<string, string>();
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
		((data.selectedSubjects as string[] | undefined) ?? [])
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
	const showOrgFeatures = $derived(data.activeOrganization?.orgType === 'group');

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

	function taskTitle(task: StudyTask): string {
		return task.unit.trim() || task.apClass;
	}

	function modeLabel(mode: StudyTask['mode']): string {
		if (mode === 'frq') return 'Free response';
		if (mode === 'review') return 'Review';
		return 'MCQ';
	}

	function formatPlanTaskDate(dateKey: string): string {
		const date = new Date(`${dateKey.slice(0, 10)}T12:00:00.000Z`);
		return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
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
	<title>Home | Free AP Practice</title>
</svelte:head>

{#snippet myPlanSection()}
	{#if canViewStudyPlan}
		<section class="space-y-3" aria-labelledby="my-plan-heading">
			{#if studyPlan && planTaskCount === 0}
				<div class="flex flex-wrap items-end justify-between gap-3">
					<h2
						id="my-plan-heading"
						class="font-display text-xl font-medium tracking-tight sm:text-2xl"
					>
						My plan
					</h2>
					<a
						href={resolve('/app/plan')}
						class="text-sm font-medium text-primary underline-offset-4 hover:underline"
					>
						View plan
					</a>
				</div>
				<Card.Root class="rounded-2xl border border-border/60 py-0 shadow-sm ring-0">
					<Card.Content class="p-4 text-sm text-muted-foreground sm:p-5">
						This plan has no tasks yet.
						<a
							href={resolve('/app/plan')}
							class="font-medium text-primary underline-offset-4 hover:underline"
						>
							View plan
						</a>
					</Card.Content>
				</Card.Root>
			{:else if studyPlan && planTaskCount > 0}
				<div class="flex flex-wrap items-end justify-between gap-3">
					<h2
						id="my-plan-heading"
						class="font-display text-xl font-medium tracking-tight sm:text-2xl"
					>
						My plan
					</h2>
					<a
						href={resolve('/app/plan')}
						class="text-sm font-medium text-primary underline-offset-4 hover:underline"
					>
						View plan
					</a>
				</div>

				<Card.Root class="rounded-2xl border border-border/60 py-0 shadow-sm ring-0">
					<Card.Content class="space-y-3 p-4 sm:p-5">
						<p class="text-sm text-muted-foreground">
							{planCompletedCount} of {planTaskCount} tasks complete
						</p>

						{#if allPlanTasksComplete}
							<p class="text-sm text-muted-foreground">
								All tasks complete.
								<a
									href={resolve('/app/plan')}
									class="font-medium text-primary underline-offset-4 hover:underline"
								>
									View plan
								</a>
							</p>
						{:else}
							<div class="divide-y divide-border/70">
								{#each compactPlanTasks as task (task.id)}
									{@const isFirstIncomplete =
										task.status === 'todo' && task.id === firstIncompleteTaskId}
									<div class="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
										<div
											class={[
												'flex size-5 shrink-0 items-center justify-center rounded-full',
												task.status === 'done'
													? 'bg-foreground text-background'
													: 'border-2 border-muted-foreground/35 bg-transparent'
											]}
											aria-hidden="true"
										>
											{#if task.status === 'done'}
												<CheckIcon class="size-3 stroke-[3]" />
											{/if}
										</div>

										<div class="min-w-0 flex-1">
											<p class="truncate text-sm font-medium">{taskTitle(task)}</p>
											<p class="flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
												<span>{modeLabel(task.mode)}</span>
												<span aria-hidden="true">·</span>
												<span class="inline-flex items-center gap-0.5">
													<ClockIcon class="size-3.5" aria-hidden="true" />
													{task.durationMinutes} min
												</span>
												<span aria-hidden="true">·</span>
												<span>{formatPlanTaskDate(task.date)}</span>
											</p>
										</div>

										{#if isFirstIncomplete}
											<Button
												href={task.practiceHref ?? resolve('/app/plan')}
												size="sm"
												class="shrink-0 rounded-full px-3"
											>
												Start
												<ChevronRightIcon class="size-4" aria-hidden="true" />
											</Button>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</Card.Content>
				</Card.Root>
			{:else}
				<h2
					id="my-plan-heading"
					class="font-display text-xl font-medium tracking-tight sm:text-2xl"
				>
					My plan
				</h2>
				<Card.Root
					class="rounded-2xl border border-dashed border-border/80 bg-muted/20 shadow-none ring-0"
				>
					<Card.Content
						class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
					>
						<div class="flex items-start gap-3">
							<div
								class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
							>
								<CalendarIcon class="size-4" aria-hidden="true" />
							</div>
							<p class="text-sm text-muted-foreground">Ask Pip to build your weekly plan</p>
						</div>
						<Button
							href={resolve('/app/coach?q=Help%20me%20create%20a%20study%20plan')}
							size="sm"
							class="shrink-0"
						>
							Create with Pip
						</Button>
					</Card.Content>
				</Card.Root>
			{/if}
		</section>
	{/if}
{/snippet}

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
			<div class="flex flex-col gap-4 sm:flex-row sm:items-start">
				<div class="flex min-w-0 flex-1 flex-col gap-4 self-stretch">
					<div class="space-y-1">
						<h2
							id="recommendation-heading"
							class="font-display text-xl font-medium tracking-tight sm:text-2xl"
						>
							{recommendation.name}
						</h2>
					</div>

					<div class="mt-auto space-y-2">
						<p class="text-sm text-muted-foreground">
							{recommendation.percent}% complete · {recommendation.shown} / {SUBJECT_PROGRESS_GOAL}
							questions
						</p>
						<div
							class="h-2 w-full overflow-hidden rounded-full bg-muted"
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

					<FirstUseHint
						id="dashboard-practice"
						anchorId="dashboard-practice-hint-target"
						text="Start here. Choose a subject and begin practicing."
						align="start"
					/>
				</div>

				<div class="flex shrink-0 flex-col items-end gap-4 self-stretch max-sm:w-full">
					<div
						class="hidden size-12 items-center justify-center rounded-xl border border-primary/20 bg-background sm:flex"
						aria-hidden="true"
					>
						<RecIcon class="size-6 text-primary" />
					</div>

					<div class="mt-auto w-full sm:w-auto">
						<Button
							id="dashboard-practice-hint-target"
							href={recommendation.href}
							class="w-full sm:w-auto"
						>
							{hasPracticedRecommendation ? 'Continue practicing' : 'Start practicing'}
							<ArrowRightIcon class="size-4" aria-hidden="true" />
						</Button>
					</div>
				</div>
			</div>
		</section>
	{/if}

	{@render myPlanSection()}

	{#if showOrgFeatures}
		<OrgGroupDashboard
			orgActivity={data.orgActivity ?? []}
			orgSharedSets={data.orgSharedSets ?? []}
			orgLeaderboard={data.orgLeaderboard ?? []}
		/>
	{/if}

	{#if subjectCards.length > 0 && recommendation}
		{#if planAccess?.plan !== 'super'}
			<a
				href={resolve('/pricing')}
				class="flex items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-primary/5 px-5 py-4 text-sm transition-colors hover:bg-primary/10"
			>
				<span><span class="font-medium">Super:</span> Pip and personalized study plans.</span>
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
							href={resolve(`/app/practice?apClass=${encodeURIComponent(subject.name)}`)}
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
		{#if planAccess?.plan !== 'super'}
			<a
				href={resolve('/pricing')}
				class="flex items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-primary/5 px-5 py-4 text-sm transition-colors hover:bg-primary/10"
			>
				<span><span class="font-medium">Super:</span> Pip and personalized study plans.</span>
				<ArrowRightIcon class="size-4 shrink-0 text-primary" />
			</a>
		{/if}

		<EmptyState
			title="No subjects selected yet"
			description="Choose the subjects you want to see on your dashboard."
			imageUrl={lightbulbImage}
		>
			{#snippet button()}
				<Button href={resolve('/app/onboarding?reset=1')} variant="outline">Choose subjects</Button>
			{/snippet}
		</EmptyState>
	{/if}
</PageShell>
