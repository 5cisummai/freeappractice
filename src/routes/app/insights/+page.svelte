<script lang="ts">
	import ArrowUpRightIcon from '@lucide/svelte/icons/arrow-up-right';
	import BookOpenCheckIcon from '@lucide/svelte/icons/book-open-check';
	import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days';
	import CheckIcon from '@lucide/svelte/icons/check';
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import Clock3Icon from '@lucide/svelte/icons/clock-3';
	import Repeat2Icon from '@lucide/svelte/icons/repeat-2';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import TargetIcon from '@lucide/svelte/icons/target';
	import TrendingUpIcon from '@lucide/svelte/icons/trending-up';
	import { apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/api.js';
	import EmptyState from '$lib/components/app/empty-state.svelte';
	import PageShell from '$lib/components/layout/page-shell.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Empty from '$lib/components/ui/empty/index.js';
	import * as Progress from '$lib/components/ui/progress/index.js';
	import type { StudyPlanInsights, StudyPlanView, StudyTask } from '$lib/super/types';
	import { cn } from '$lib/utils.js';

	let { data, form } = $props();
	let planOverride = $state<StudyPlanView | null | undefined>(undefined);
	let completingTaskId = $state<string | null>(null);
	let errorMessage = $state('');

	const plan = $derived(planOverride !== undefined ? planOverride : data.plan);
	const insights = $derived(plan?.insights ?? null);
	const completedCount = $derived(plan?.tasks.filter((task) => task.status === 'done').length ?? 0);
	const taskCount = $derived(plan?.tasks.length ?? 0);
	const weekDays = $derived(buildWeekDays(plan?.startsOn ?? new Date().toISOString()));
	const completionPercent = $derived(
		taskCount ? Math.round((completedCount / taskCount) * 100) : 0
	);

	function dateKey(value: Date | string): string {
		const date = value instanceof Date ? value : new Date(value);
		return date.toISOString().slice(0, 10);
	}

	function buildWeekDays(startsOn: string): Array<{ date: string; key: string }> {
		const start = new Date(startsOn);
		return Array.from({ length: 7 }, (_, index) => {
			const date = new Date(start.getTime() + index * 24 * 60 * 60 * 1000);
			return { date: date.toISOString(), key: dateKey(date) };
		});
	}

	function formatDate(value: string, options: Intl.DateTimeFormatOptions): string {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return 'Unknown date';
		return date.toLocaleDateString(undefined, options);
	}

	function formatWindow(window: StudyPlanInsights['window']): string {
		return (
			formatDate(window.startsOn, { month: 'short', day: 'numeric' }) +
			' – ' +
			formatDate(window.endsOn, { month: 'short', day: 'numeric' })
		);
	}

	function formatDayName(value: string): string {
		return formatDate(value, { weekday: 'short' });
	}

	function formatDayNumber(value: string): string {
		return formatDate(value, { month: 'short', day: 'numeric' });
	}

	function formatGeneratedAt(value: string): string {
		return formatDate(value, { month: 'short', day: 'numeric', year: 'numeric' });
	}

	function tasksForDay(day: string): StudyTask[] {
		return plan?.tasks.filter((task) => dateKey(task.date) === day) ?? [];
	}

	function kindLabel(kind: StudyPlanInsights['focusAreas'][number]['kind']): string {
		if (kind === 'momentum') return 'Momentum';
		if (kind === 'habit') return 'Habit';
		return 'Focus';
	}

	function taskModeLabel(mode: StudyTask['mode']): string {
		if (mode === 'frq') return 'FRQ';
		if (mode === 'review') return 'Review';
		return 'MCQ';
	}

	function taskLabel(task: StudyTask): string {
		if (task.mode === 'frq') return 'Write an FRQ for ' + task.apClass;
		if (task.mode === 'review') return 'Review ' + task.apClass;
		return 'Practice ' + task.apClass;
	}

	function taskDescription(task: StudyTask): string {
		return task.unit + ' · ' + task.durationMinutes + ' min';
	}

	function focusIcon(kind: StudyPlanInsights['focusAreas'][number]['kind']) {
		if (kind === 'momentum') return TrendingUpIcon;
		if (kind === 'habit') return Repeat2Icon;
		return TargetIcon;
	}

	async function completeTask(task: StudyTask): Promise<void> {
		if (task.status === 'done' || completingTaskId) return;
		completingTaskId = task.id;
		errorMessage = '';
		try {
			const response = await apiFetch('/api/study-plan', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Idempotency-Key': crypto.randomUUID()
				},
				body: JSON.stringify({ action: 'complete', taskId: task.id })
			});
			const payload = await readJsonOrNull<{ plan?: StudyPlanView; error?: string }>(response);
			if (!response.ok || !payload?.plan) {
				throw new Error(getResponseMessage(payload, 'Could not update the study plan.'));
			}
			planOverride = payload.plan;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Could not update the study plan.';
		} finally {
			completingTaskId = null;
		}
	}
</script>

<svelte:head>
	<title>Insights | Free AP Practice</title>
</svelte:head>

<PageShell
	title="Insights"
	description="Your weekly practice readout and study plan, refreshed every Saturday."
>
	{#if !data.canView}
		<Card.Root class="mx-auto w-full max-w-2xl">
			<Card.Header>
				<Card.Title>Insights requires Super</Card.Title>
				<Card.Description>{data.accessMessage}</Card.Description>
			</Card.Header>
			<Card.Footer>
				<Button href="/pricing">See Super</Button>
			</Card.Footer>
		</Card.Root>
	{:else if !plan}
		<EmptyState
			title="Your first weekly readout is on the way."
			description={form?.error ?? 'Generate a readout now or wait for the next Saturday refresh.'}
			imageUrl="/illustrations/lightbulb.png"
		>
			{#snippet button()}
				<form method="POST" action="?/generate">
					<Button type="submit">Generate now</Button>
				</form>
			{/snippet}
		</EmptyState>
	{:else}
		{#if insights}
			<section class="flex flex-col gap-6" aria-labelledby="weekly-readout-heading">
				<Card.Root class="overflow-hidden border-primary/20 bg-primary/[0.03] shadow-sm">
					<Card.Content class="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_20rem] lg:items-center">
						<div class="flex flex-col gap-5">
							<div class="flex flex-wrap items-center gap-2">
								<Badge variant="secondary">
									<SparklesIcon data-icon="inline-start" />
									Weekly readout
								</Badge>
								<span class="text-xs text-muted-foreground">
									Based on {formatWindow(insights.window)}
								</span>
							</div>
							<div class="max-w-2xl">
								<h2
									id="weekly-readout-heading"
									class="font-display text-3xl leading-tight tracking-tight text-balance sm:text-4xl"
								>
									{insights.headline}
								</h2>
								<p class="mt-3 max-w-xl text-base leading-7 text-muted-foreground">
									{insights.summary}
								</p>
							</div>
							<p class="text-xs text-muted-foreground">
								Updated {formatGeneratedAt(insights.generatedAt)}
							</p>
						</div>

						<div
							class="grid grid-cols-2 overflow-hidden rounded-xl border border-border/70 bg-background/70"
						>
							<div class="border-r border-b border-border/70 p-4">
								<p class="text-2xl font-semibold tabular-nums">{insights.metrics.mcqAttempts}</p>
								<p class="mt-1 text-xs text-muted-foreground">MCQs answered</p>
							</div>
							<div class="border-b border-border/70 p-4">
								<p class="text-2xl font-semibold tabular-nums">
									{insights.metrics.mcqAccuracy === null ? '—' : insights.metrics.mcqAccuracy + '%'}
								</p>
								<p class="mt-1 text-xs text-muted-foreground">MCQ accuracy</p>
							</div>
							<div class="border-r border-border/70 p-4">
								<p class="text-2xl font-semibold tabular-nums">{insights.metrics.frqSubmissions}</p>
								<p class="mt-1 text-xs text-muted-foreground">FRQs submitted</p>
							</div>
							<div class="p-4">
								<p class="text-2xl font-semibold tabular-nums">{insights.metrics.activeDays}</p>
								<p class="mt-1 text-xs text-muted-foreground">Active days</p>
							</div>
						</div>
					</Card.Content>
				</Card.Root>

				<div class="flex flex-col gap-1">
					<p class="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
						Signals from your week
					</p>
					<h3 class="font-display text-2xl tracking-tight">What deserves your attention</h3>
				</div>

				<div class="grid gap-4 md:grid-cols-3">
					{#each insights.focusAreas as area (area.title)}
						{@const Icon = focusIcon(area.kind)}
						<Card.Root class="h-full shadow-none">
							<Card.Header class="gap-3">
								<div class="flex items-center justify-between gap-3">
									<Badge variant="outline">
										<Icon data-icon="inline-start" />
										{kindLabel(area.kind)}
									</Badge>
									{#if area.apClass && area.unit}
										<span class="truncate text-right text-xs text-muted-foreground">
											{area.apClass} · {area.unit}
										</span>
									{/if}
								</div>
								<Card.Title class="text-base">{area.title}</Card.Title>
								<Card.Description class="leading-6">{area.detail}</Card.Description>
							</Card.Header>
							<Card.Content class="pt-0">
								<p
									class="border-l-2 border-primary/30 pl-3 text-sm leading-6 text-muted-foreground"
								>
									{area.why}
								</p>
							</Card.Content>
						</Card.Root>
					{:else}
						<Empty.Root class="border border-dashed md:col-span-3">
							<Empty.Header>
								<Empty.Title>No clear pattern yet.</Empty.Title>
								<Empty.Description>
									Keep practicing and your next weekly readout will have more signal to work with.
								</Empty.Description>
							</Empty.Header>
						</Empty.Root>
					{/each}
				</div>
			</section>
		{:else}
			<Card.Root class="border-dashed shadow-none">
				<Card.Content class="flex items-start gap-3 p-5 text-sm text-muted-foreground">
					<CircleAlertIcon class="mt-0.5 size-4 shrink-0" />
					<p>Your weekly readout will appear after the next Saturday refresh.</p>
				</Card.Content>
			</Card.Root>
		{/if}

		<section class="flex flex-col gap-4" aria-labelledby="study-calendar-heading">
			<div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
				<div class="flex flex-col gap-1">
					<p class="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
						Your week
					</p>
					<h2 id="study-calendar-heading" class="font-display text-2xl tracking-tight">
						Weekly study calendar
					</h2>
				</div>
				<div class="flex items-center gap-3 text-sm text-muted-foreground">
					{#if taskCount}
						<span class="tabular-nums">{completedCount}/{taskCount} complete</span>
						<div class="w-24">
							<Progress.Root
								value={completionPercent}
								aria-label={completionPercent + '% complete'}
							/>
						</div>
					{:else}
						<span>Plan is still taking shape</span>
					{/if}
				</div>
			</div>

			{#if plan.insights?.planRationale}
				<p class="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
					<BookOpenCheckIcon class="mt-1 size-4 shrink-0 text-primary" />
					<span>{plan.insights.planRationale}</span>
				</p>
			{/if}

			{#if errorMessage}
				<Card.Root class="border-destructive/20 bg-destructive/5 shadow-none">
					<Card.Content class="flex items-start gap-3 p-4 text-sm text-destructive">
						<CircleAlertIcon class="mt-0.5 size-4 shrink-0" />
						<p>{errorMessage}</p>
					</Card.Content>
				</Card.Root>
			{/if}

			{#if taskCount}
				<Card.Root class="overflow-hidden shadow-none">
					<Card.Content class="overflow-x-auto p-0">
						<div class="grid min-w-[980px] grid-cols-7 divide-x divide-border/70">
							{#each weekDays as day (day.key)}
								{@const dayTasks = tasksForDay(day.key)}
								<div class="min-h-72 bg-muted/[0.12]">
									<div
										class={cn(
											'border-b border-border/70 px-3 py-4',
											day.key === dateKey(new Date()) && 'bg-primary/[0.06]'
										)}
									>
										<div class="flex items-center justify-between gap-2">
											<p class="text-xs font-semibold tracking-wide uppercase">
												{formatDayName(day.date)}
											</p>
											{#if day.key === dateKey(new Date())}
												<Badge variant="secondary">Today</Badge>
											{/if}
										</div>
										<p class="mt-1 text-xs text-muted-foreground">{formatDayNumber(day.date)}</p>
									</div>
									<div class="flex min-h-56 flex-col gap-3 p-3">
										{#each dayTasks as task (task.id)}
											<Card.Root
												size="sm"
												class={cn(
													'bg-background/80 shadow-none',
													task.status === 'done' && 'opacity-60'
												)}
											>
												<Card.Content class="flex flex-col gap-3 p-3">
													<div class="flex items-start justify-between gap-2">
														<Badge variant="outline">{taskModeLabel(task.mode)}</Badge>
														<Button
															variant={task.status === 'done' ? 'secondary' : 'outline'}
															size="icon-xs"
															aria-label={task.status === 'done' ? 'Completed' : 'Mark complete'}
															disabled={task.status === 'done' || completingTaskId !== null}
															onclick={() => void completeTask(task)}
														>
															{#if task.status === 'done'}<CheckIcon
																	data-icon="inline-start"
																/>{:else}<span class="size-2 rounded-full bg-muted-foreground/50"
																></span>{/if}
														</Button>
													</div>
													<p class="text-sm leading-5 font-medium">{taskLabel(task)}</p>
													<p class="text-xs leading-5 text-muted-foreground">
														{taskDescription(task)}
													</p>
													<div class="flex items-center justify-between gap-2">
														<span class="flex items-center gap-1 text-xs text-muted-foreground">
															<Clock3Icon class="size-3" />
															{task.durationMinutes} min
														</span>
														{#if task.practiceHref}
															<Button
																variant="ghost"
																size="icon-xs"
																href={task.practiceHref}
																aria-label="Open practice"
															>
																<ArrowUpRightIcon data-icon="inline-start" />
															</Button>
														{/if}
													</div>
												</Card.Content>
											</Card.Root>
										{:else}
											<p
												class="flex flex-1 items-center justify-center px-2 text-center text-xs text-muted-foreground/70"
											>
												Open space
											</p>
										{/each}
									</div>
								</div>
							{/each}
						</div>
					</Card.Content>
				</Card.Root>
			{:else}
				<Empty.Root class="border border-dashed">
					<Empty.Header>
						<Empty.Media variant="icon">
							<CalendarDaysIcon />
						</Empty.Media>
						<Empty.Title>Your weekly calendar is still taking shape.</Empty.Title>
						<Empty.Description>
							Once Super has enough course and unit context, your next seven study sessions will
							appear here.
						</Empty.Description>
					</Empty.Header>
				</Empty.Root>
			{/if}
		</section>
	{/if}
</PageShell>
