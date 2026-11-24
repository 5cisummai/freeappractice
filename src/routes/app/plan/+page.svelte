<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Progress from '#lib/components/ui/progress/index.js';
	import PageShell from '#lib/components/layout/page-shell.svelte';
	import type { StudyTask } from '#lib/agent/plans/types.js';
	import type { PageProps } from './$types';
	import CalendarIcon from '@tabler/icons-svelte/icons/calendar-week-filled';
	import CheckIcon from '@tabler/icons-svelte/icons/check';
	import ClockIcon from '@tabler/icons-svelte/icons/clock';
	import ArrowRightIcon from '@tabler/icons-svelte/icons/arrow-right';

	let { data, form }: PageProps = $props();
	let submittingTaskId = $state<string | null>(null);

	const taskDays = $derived.by(() => {
		const days: Array<[string, StudyTask[]]> = [];
		const tasks = [...(data.plan?.tasks ?? [])].sort((a, b) => a.date.localeCompare(b.date));
		for (const task of tasks) {
			const key = task.date.slice(0, 10);
			const lastDay = days.at(-1);
			if (lastDay?.[0] === key) lastDay[1].push(task);
			else days.push([key, [task]]);
		}
		return days;
	});

	const firstIncompleteTaskId = $derived.by(() => {
		const tasks = [...(data.plan?.tasks ?? [])].sort((a, b) => a.date.localeCompare(b.date));
		return tasks.find((task) => task.status === 'todo')?.id ?? null;
	});

	const completedCount = $derived(
		data.plan?.tasks.filter((task) => task.status === 'done').length ?? 0
	);
	const taskCount = $derived(data.plan?.tasks.length ?? 0);
	const completionPercent = $derived(
		taskCount ? Math.round((completedCount / taskCount) * 100) : 0
	);

	function formatDateColumn(dateKey: string): { weekday: string; day: string; month: string } {
		const date = new Date(`${dateKey}T12:00:00.000Z`);
		return {
			weekday: date.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' }),
			day: date.toLocaleDateString(undefined, { day: 'numeric', timeZone: 'UTC' }),
			month: date.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' })
		};
	}

	function taskTitle(task: StudyTask): string {
		return task.unit.trim() || task.course;
	}

	function modeLabel(mode: 'mcq' | 'frq' | 'review'): string {
		if (mode === 'frq') return 'Free response';
		if (mode === 'review') return 'Review';
		return 'MCQ';
	}

	function isActiveTask(task: StudyTask): boolean {
		return task.status === 'todo' && task.id === firstIncompleteTaskId;
	}
</script>

<svelte:head>
	<title>Plan | Free AP Practice</title>
</svelte:head>

<PageShell title="Study plan" description="Your weekly study schedule, created with Pip.">
	{#snippet actions()}
		{#if data.canView && data.plan}
			<Button
				href="/app/coach?q=Create%20a%20new%20study%20plan%20starting%20today.%20Use%20my%20current%20plan%20as%20context."
				variant="outline"
			>
				New plan
			</Button>
		{/if}
	{/snippet}

	{#if !data.canView}
		<Card.Root class="w-full max-w-2xl">
			<Card.Header>
				<Card.Title>
					{data.accessCode === 'age_required'
						? 'Confirm your age'
						: data.accessCode === 'subscription_required'
							? 'Study plans require Super'
							: 'Study plans are unavailable'}
				</Card.Title>
				<Card.Description>{data.accessMessage}</Card.Description>
			</Card.Header>
			{#if data.accessCode === 'age_required' || data.accessCode === 'subscription_required'}
				<Card.Footer>
					<Button href={data.accessCode === 'age_required' ? '/app/confirm-age' : '/pricing'}>
						{data.accessCode === 'age_required' ? 'Confirm age' : 'See Super'}
					</Button>
				</Card.Footer>
			{/if}
		</Card.Root>
	{:else if !data.plan}
		<Card.Root class="w-full max-w-2xl shadow-none">
			<Card.Header>
				<Card.Title>
					{data.planExpired ? 'Your study plan ended' : 'Your weekly plan starts with Pip'}
				</Card.Title>
				<Card.Description>
					{data.planExpired
						? 'Start a new week of practice with Pip.'
						: 'Ask Pip to build a study plan around your classes, goals, and available study time.'}
				</Card.Description>
			</Card.Header>
			<Card.Footer>
				<Button
					href={data.planExpired
						? '/app/coach?q=Build%20a%20new%20weekly%20study%20plan%20starting%20today.%20Merge%20it%20with%20my%20saved%20plan%20to%20preserve%20completed%20tasks.'
						: '/app/coach?q=Help%20me%20create%20a%20study%20plan'}
				>
					{data.planExpired ? 'Create a new plan' : 'Create a plan with Pip'}
				</Button>
			</Card.Footer>
		</Card.Root>
	{:else}
		{#if form?.error}
			<Card.Root class="mb-5 bg-destructive/5 py-0 shadow-none">
				<Card.Content class="p-4 text-sm text-destructive" role="alert">
					{form.error}
				</Card.Content>
			</Card.Root>
		{/if}

		<Card.Root class="mb-5 py-0 shadow-none">
			<Card.Content
				class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-5"
			>
				<div class="flex items-center gap-3">
					<div
						class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"
					>
						<CalendarIcon class="size-5" />
					</div>
					<div>
						<p class="font-medium">Weekly progress</p>
						<p class="text-sm text-muted-foreground">
							{completedCount} of {taskCount} tasks complete
						</p>
					</div>
				</div>
				<div class="w-full sm:w-40">
					<Progress.Root value={completionPercent} aria-label={`${completionPercent}% complete`} />
				</div>
			</Card.Content>
		</Card.Root>

		{#if taskDays.length}
			<Card.Root class="overflow-hidden py-0 shadow-none">
				<Card.Content class="p-0">
					{#each taskDays as [day, tasks] (day)}
						{@const dateParts = formatDateColumn(day)}
						<section
							aria-labelledby={`plan-day-${day}`}
							class="border-t border-border first:border-t-0 sm:grid sm:grid-cols-[5rem_minmax(0,1fr)]"
						>
							<h2
								id={`plan-day-${day}`}
								class="flex items-baseline gap-1.5 border-b border-border/60 bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground sm:flex-col sm:items-center sm:gap-0.5 sm:border-e sm:border-b-0 sm:px-2 sm:py-4"
							>
								<span>{dateParts.weekday}</span>
								<span class="tabular-nums sm:text-xl sm:leading-tight sm:text-foreground">
									{dateParts.day}
								</span>
								<span>{dateParts.month}</span>
							</h2>
							<div class="min-w-0 flex-1">
								{#each tasks as task, taskIndex (task.id)}
									{@const active = isActiveTask(task)}
									<div
										class={[
											'grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2 px-4 py-3.5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:px-5 sm:py-4',
											taskIndex > 0 ? 'border-t border-border/60' : ''
										]}
									>
										<div
											class={[
												'mt-0.5 flex size-5 items-center justify-center rounded-full sm:mt-0',
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

										<div class="min-w-0 space-y-1">
											<p
												class={[
													'leading-snug font-semibold',
													task.status === 'done'
														? 'text-muted-foreground line-through'
														: 'text-foreground'
												]}
											>
												{taskTitle(task)}
											</p>
											<p
												class="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground"
											>
												<span>{modeLabel(task.mode)}</span>
												<span aria-hidden="true">/</span>
												<span class="inline-flex items-center gap-0.5">
													<ClockIcon class="size-3.5" />
													{task.durationMinutes} min
												</span>
												<span aria-hidden="true">/</span>
												<span>{task.course}</span>
											</p>
										</div>

										<div class="col-start-2 sm:col-start-3">
											{#if task.status === 'done'}
												<Button variant="secondary" size="sm" class="px-3" disabled>
													Start task
													<ArrowRightIcon class="size-4" aria-hidden="true" />
												</Button>
											{:else if task.practiceHref}
												<Button
													href={task.practiceHref}
													variant={active ? 'default' : 'outline'}
													size="sm"
													class="px-3"
												>
													Start task
													<ArrowRightIcon class="size-4" aria-hidden="true" />
												</Button>
											{:else}
												<form
													method="POST"
													action="?/complete"
													use:enhance={() => {
														submittingTaskId = task.id;
														return async ({ update }) => {
															try {
																await update();
															} finally {
																submittingTaskId = null;
															}
														};
													}}
												>
													<input type="hidden" name="taskId" value={task.id} />
													<Button
														type="submit"
														variant={active ? 'default' : 'outline'}
														size="sm"
														class="px-3"
														disabled={submittingTaskId !== null}
													>
														Start task
														<ArrowRightIcon class="size-4" aria-hidden="true" />
													</Button>
												</form>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						</section>
					{/each}
				</Card.Content>
			</Card.Root>
		{:else}
			<Card.Root class="py-0 shadow-none">
				<Card.Content
					class="flex flex-wrap items-center gap-x-3 gap-y-1 p-4 text-sm text-muted-foreground sm:px-5"
				>
					This plan has no tasks yet. Ask Pip to update your weekly plan.
					<Button href="/app/coach" variant="link" size="sm" class="h-auto p-0">Open Pip</Button>
				</Card.Content>
			</Card.Root>
		{/if}
	{/if}
</PageShell>
