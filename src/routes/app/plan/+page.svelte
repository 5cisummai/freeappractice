<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Progress from '$lib/components/ui/progress/index.js';
	import PageShell from '$lib/components/layout/page-shell.svelte';
	import type { StudyTask } from '$lib/super/types';
	import type { PageProps } from './$types';
	import CalendarIcon from '@tabler/icons-svelte/icons/calendar-week-filled';
	import CheckIcon from '@tabler/icons-svelte/icons/check';
	import ClockIcon from '@tabler/icons-svelte/icons/clock';
	import ChevronRightIcon from '@tabler/icons-svelte/icons/chevron-right';

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
		<Card.Root class="mx-auto w-full max-w-2xl">
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
		<Card.Root class="mx-auto w-full max-w-2xl border-dashed shadow-none">
			<Card.Header>
				<Card.Title>Your weekly plan starts with Pip</Card.Title>
				<Card.Description>
					Ask Pip to build a study plan around your classes, goals, and available study time.
				</Card.Description>
			</Card.Header>
			<Card.Footer>
				<Button href="/app/coach?q=Help%20me%20create%20a%20study%20plan">
					Create a plan with Pip
				</Button>
			</Card.Footer>
		</Card.Root>
	{:else}
		{#if form?.error}
			<Card.Root class="border-destructive/20 bg-destructive/5 shadow-none">
				<Card.Content class="p-4 text-sm text-destructive" role="alert">
					{form.error}
				</Card.Content>
			</Card.Root>
		{/if}

		<Card.Root class="shadow-none">
			<Card.Content class="flex flex-wrap items-center justify-between gap-4 p-5">
				<div class="flex items-center gap-3">
					<div
						class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"
					>
						<CalendarIcon class="size-5" />
					</div>
					<div>
						<p class="font-medium">This week</p>
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
			<Card.Root class="overflow-hidden shadow-none">
				<Card.Content class="p-0">
					{#each taskDays as [day, tasks], dayIndex (day)}
						{@const dateParts = formatDateColumn(day)}
						{#if dayIndex > 0}
							<div class="border-t border-border" role="separator"></div>
						{/if}
						<section aria-labelledby={`plan-day-${day}`} class="flex items-stretch">
							<div
								class="flex w-[4.5rem] shrink-0 flex-col items-center justify-center self-center px-3 py-6 text-center"
							>
								<span id={`plan-day-${day}`} class="text-xs text-muted-foreground">
									{dateParts.weekday}
								</span>
								<span class="text-2xl leading-tight font-bold tabular-nums">{dateParts.day}</span>
								<span class="text-xs text-muted-foreground">{dateParts.month}</span>
							</div>
							<div class="min-w-0 flex-1">
								{#each tasks as task, taskIndex (task.id)}
									{@const active = isActiveTask(task)}
									<div
										class={[
											'flex items-center gap-3 py-4 pr-4 pl-2 sm:gap-4 sm:pr-5',
											taskIndex > 0 ? 'border-t border-border/60' : ''
										]}
									>
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

										<div class="min-w-0 flex-1 space-y-1">
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

										<div class="shrink-0">
											{#if task.status === 'done'}
												<Button variant="secondary" size="sm" class="rounded-full px-3" disabled>
													Start
													<ChevronRightIcon class="size-4" />
												</Button>
											{:else if task.practiceHref}
												<Button
													href={task.practiceHref}
													variant={active ? 'default' : 'secondary'}
													size="sm"
													class="rounded-full px-3"
												>
													Start
													<ChevronRightIcon class="size-4" />
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
														variant={active ? 'default' : 'secondary'}
														size="sm"
														class="rounded-full px-3"
														disabled={submittingTaskId !== null}
													>
														Start
														<ChevronRightIcon class="size-4" />
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
			<Card.Root class="border-dashed shadow-none">
				<Card.Content class="p-5 text-sm text-muted-foreground">
					This plan has no tasks yet. Ask Pip to update your weekly plan.
					<Button href="/app/coach" variant="link" size="sm">Open Pip</Button>
				</Card.Content>
			</Card.Root>
		{/if}
	{/if}
</PageShell>
