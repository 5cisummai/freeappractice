<script lang="ts">
	import { resolve } from '$app/paths';
	import ArrowRightIcon from '@tabler/icons-svelte/icons/arrow-right';
	import ChevronDownIcon from '@tabler/icons-svelte/icons/chevron-down';
	import Clock3Icon from '@tabler/icons-svelte/icons/clock-hour-3';
	import TargetIcon from '@tabler/icons-svelte/icons/target';
	import TrendingUpIcon from '@tabler/icons-svelte/icons/trending-up';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { MasteryTopic, ProgressEntry, StatsData } from '$lib/users/types.js';
	import { cn } from '$lib/utils.js';
	import { performanceBarClass, performanceTextClass } from '$lib/components/app/performance.js';

	type TopicGroup = 'strong' | 'developing' | 'weak' | 'notEnough';

	type TopicGroups = Record<TopicGroup, MasteryTopic[]>;

	type UnitCard = {
		key: string;
		name: string;
		mastery: number;
		attempts: number;
		lastPracticed?: string;
		recentDelta?: number;
		recentMistakes: number;
		topicGroups: TopicGroups;
	};

	type Props = {
		progress: ProgressEntry[];
		stats: StatsData;
		selectedSubjects?: string[];
	};

	let { progress, stats, selectedSubjects = [] }: Props = $props();
	let selectedSubject = $state<string | undefined>(undefined);
	let expandedUnit = $state<string | null>(null);

	const availableSubjects = $derived(
		[
			...new Set([
				...selectedSubjects,
				...(stats.subjectBreakdown ?? []).map((subject) => subject.subject),
				...progress.map((entry) => entry.apClass)
			])
		].sort((a, b) => a.localeCompare(b))
	);
	const currentSubject = $derived(selectedSubject || availableSubjects[0] || '');
	const subjectStats = $derived(
		(stats.subjectBreakdown ?? []).find((subject) => subject.subject === currentSubject)
	);

	function topicGroup(topic: MasteryTopic): TopicGroup {
		if (topic.attempts < 3 || topic.mastery === null) return 'notEnough';
		if (topic.mastery >= 75) return 'strong';
		if (topic.mastery >= 50) return 'developing';
		return 'weak';
	}

	function groupTopics(topics: MasteryTopic[] | undefined): TopicGroups {
		const groups: TopicGroups = { strong: [], developing: [], weak: [], notEnough: [] };
		for (const topic of topics ?? []) groups[topicGroup(topic)].push(topic);
		return groups;
	}

	function unitMastery(entry: ProgressEntry): number {
		if (entry.totalAttempts > 0) return entry.mastery;
		return entry.frqAveragePercentage ?? 0;
	}

	function lastPracticed(entry: ProgressEntry): string | undefined {
		const dates = [entry.lastAttemptAt, entry.frqLastAttemptAt]
			.filter((date): date is string => Boolean(date))
			.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
		return dates[0];
	}

	const unitCards = $derived(
		progress
			.filter(
				(entry) =>
					entry.apClass === currentSubject &&
					(entry.totalAttempts > 0 || (entry.frqAttempts ?? 0) > 0)
			)
			.map((entry): UnitCard => ({
				key: `${entry.apClass}:${entry.unit}`,
				name: entry.unit || 'All units',
				mastery: unitMastery(entry),
				attempts: entry.totalAttempts + (entry.frqAttempts ?? 0),
				lastPracticed: lastPracticed(entry),
				recentDelta: entry.recentDelta,
				recentMistakes: entry.recentMistakes ?? 0,
				topicGroups: groupTopics(entry.topics)
			}))
			.sort((a, b) => a.name.localeCompare(b.name))
	);

	const questionsAnswered = $derived(
		subjectStats?.total ?? unitCards.reduce((sum, unit) => sum + unit.attempts, 0)
	);
	const accuracy = $derived(
		subjectStats?.accuracy ??
			(questionsAnswered > 0
				? Math.round(
						unitCards.reduce((sum, unit) => sum + unit.mastery * unit.attempts, 0) /
							questionsAnswered
					)
				: 0)
	);
	const overallMastery = $derived(accuracy);
	const overallLevel = $derived(
		questionsAnswered === 0
			? 'Not enough data'
			: overallMastery >= 75
				? 'Strong'
				: overallMastery >= 50
					? 'Developing'
					: 'Needs work'
	);

	const strongestUnit = $derived(
		[...unitCards].sort((a, b) => b.mastery - a.mastery || b.attempts - a.attempts)[0]
	);
	const recommendedUnit = $derived(
		[...unitCards].sort((a, b) => {
			const priority = (unit: UnitCard) => {
				const daysSincePractice = unit.lastPracticed
					? Math.min(
							30,
							Math.max(0, (Date.now() - new Date(unit.lastPracticed).getTime()) / 86_400_000)
						)
					: 30;
				return 100 - unit.mastery + unit.recentMistakes * 4 + daysSincePractice;
			};
			return priority(b) - priority(a);
		})[0]
	);
	const weakestUnit = $derived(
		[...unitCards].sort((a, b) => a.mastery - b.mastery || b.attempts - a.attempts)[0]
	);
	const summary = $derived(
		unitCards.length === 0
			? 'Answer a few questions to see unit-level mastery.'
			: `Strongest in ${strongestUnit?.name ?? 'your recent work'}. Needs work in ${weakestUnit?.name ?? 'new units'}.`
	);

	function formatLastPracticed(date: string | undefined): string {
		if (!date) return 'Not practiced yet';
		return new Intl.DateTimeFormat(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		}).format(new Date(date));
	}

	function formatPracticeTime(): number {
		const averageSeconds = subjectStats?.avgTimeSeconds ?? 80;
		return Math.max(5, Math.round((averageSeconds * 6) / 60));
	}

	function practiceHref(unit?: string): string {
		const unitParam = unit && unit !== 'All units' ? `&unit=${encodeURIComponent(unit)}` : '';
		return `${resolve('/app/practice')}?apClass=${encodeURIComponent(currentSubject)}${unitParam}`;
	}

	function topicLabel(group: TopicGroup): string {
		switch (group) {
			case 'strong':
				return 'Strong topics';
			case 'developing':
				return 'Developing topics';
			case 'weak':
				return 'Weak topics';
			case 'notEnough':
				return 'Not enough data';
			default: {
				const exhaustiveGroup: never = group;
				return exhaustiveGroup;
			}
		}
	}
</script>

{#if availableSubjects.length > 0}
	<section class="space-y-6" aria-labelledby="mastery-heading">
		<div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
			<div class="space-y-1">
				<p class="text-sm font-medium text-muted-foreground">Subject</p>
				<Select.Root
					type="single"
					value={currentSubject}
					onValueChange={(value) => (selectedSubject = value)}
				>
					<Select.Trigger class="h-10 min-w-56" aria-label="Choose an AP course">
						{currentSubject || 'Choose a course'}
					</Select.Trigger>
					<Select.Content>
						<Select.Group>
							<Select.Label>AP courses</Select.Label>
							{#each availableSubjects as subject (subject)}
								<Select.Item value={subject}>{subject}</Select.Item>
							{/each}
						</Select.Group>
					</Select.Content>
				</Select.Root>
			</div>
		</div>

		<section class="space-y-4" aria-labelledby="mastery-heading">
			<div class="space-y-1">
				<h2
					id="mastery-heading"
					class="font-display text-xl font-medium tracking-tight sm:text-2xl"
				>
					Overall mastery
				</h2>
				<p class="text-sm text-muted-foreground">{summary}</p>
			</div>

			<Card.Root class="rounded-2xl border border-border/60 py-0 shadow-sm ring-0">
				<div class="grid gap-5 p-5 sm:grid-cols-[1.2fr_repeat(3,1fr)] sm:p-6">
					<div class="flex items-center gap-4">
						<div
							class={cn(
								'flex size-14 shrink-0 items-center justify-center rounded-2xl bg-muted',
								performanceTextClass(overallMastery)
							)}
						>
							<TargetIcon class="size-7" aria-hidden="true" />
						</div>
						<div>
							<p class="text-sm text-muted-foreground">Level</p>
							<p class="text-lg font-semibold">{overallLevel}</p>
							<p class="text-xs text-muted-foreground">{overallMastery}% mastery</p>
						</div>
					</div>
					<div>
						<p class="text-sm text-muted-foreground">Mastery</p>
						<p
							class={cn(
								'mt-1 text-2xl font-semibold tabular-nums',
								performanceTextClass(overallMastery)
							)}
						>
							{overallMastery}%
						</p>
					</div>
					<div>
						<p class="text-sm text-muted-foreground">Questions answered</p>
						<p class="mt-1 text-2xl font-semibold tabular-nums">{questionsAnswered}</p>
					</div>
					<div>
						<p class="text-sm text-muted-foreground">Accuracy</p>
						<p
							class={cn('mt-1 text-2xl font-semibold tabular-nums', performanceTextClass(accuracy))}
						>
							{accuracy}%
						</p>
					</div>
				</div>
			</Card.Root>
		</section>

		<section class="space-y-4" aria-labelledby="recommended-practice-heading">
			<div class="space-y-1">
				<h2
					id="recommended-practice-heading"
					class="font-display text-xl font-medium tracking-tight sm:text-2xl"
				>
					Recommended next practice
				</h2>
			</div>
			<Card.Root class="rounded-2xl border border-border/60 py-0 shadow-sm ring-0">
				<div class="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
					{#if recommendedUnit}
						<div class="flex items-start gap-3">
							<div class="mt-0.5 rounded-lg bg-rose-500/10 p-2 text-rose-600 dark:text-rose-400">
								<TrendingUpIcon class="size-5" aria-hidden="true" />
							</div>
							<div>
								<p class="font-semibold">{recommendedUnit.name}</p>
								<p class="mt-1 text-sm text-muted-foreground">
									6 questions · about {formatPracticeTime()} minutes
								</p>
								<p class="mt-1 text-xs text-muted-foreground">
									{recommendedUnit.mastery}% mastery
									{#if recommendedUnit.recentMistakes > 0}
										· {recommendedUnit.recentMistakes} recent mistake{recommendedUnit.recentMistakes ===
										1
											? ''
											: 's'}
									{/if}
								</p>
							</div>
						</div>
						<Button href={practiceHref(recommendedUnit.name)}>
							Practice now
							<ArrowRightIcon class="size-4" aria-hidden="true" />
						</Button>
					{:else}
						<div>
							<p class="font-semibold">Build your first recommendation</p>
							<p class="mt-1 text-sm text-muted-foreground">
								Practice a few questions in this course to get started.
							</p>
						</div>
						<Button href={practiceHref()}>
							Start practice
							<ArrowRightIcon class="size-4" aria-hidden="true" />
						</Button>
					{/if}
				</div>
			</Card.Root>
		</section>

		<section class="space-y-4" aria-labelledby="mastery-by-unit-heading">
			<div class="space-y-1">
				<h2
					id="mastery-by-unit-heading"
					class="font-display text-xl font-medium tracking-tight sm:text-2xl"
				>
					Mastery by unit
				</h2>
			</div>

			{#if unitCards.length === 0}
				<Card.Root class="rounded-2xl border border-border/60 py-0 shadow-sm ring-0">
					<div class="p-5 text-sm text-muted-foreground">
						No unit activity yet for {currentSubject}. Start a practice session to build your
						mastery map.
					</div>
				</Card.Root>
			{:else}
				<Card.Root class="rounded-2xl border border-border/60 py-0 shadow-sm ring-0">
					<div class="divide-y divide-border/70">
						{#each unitCards as unit (unit.key)}
							<div>
								<button
									type="button"
									class="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/40"
									aria-expanded={expandedUnit === unit.key}
									aria-controls={`unit-detail-${unit.key}`}
									onclick={() => (expandedUnit = expandedUnit === unit.key ? null : unit.key)}
								>
									<ChevronDownIcon
										class={cn(
											'size-4 shrink-0 text-muted-foreground transition-transform',
											expandedUnit === unit.key && 'rotate-180'
										)}
										aria-hidden="true"
									/>
									<div class="min-w-0 flex-1">
										<p class="truncate text-sm font-medium">{unit.name}</p>
										<div class="mt-2 flex items-center gap-3">
											<div
												class="h-2 min-w-24 flex-1 overflow-hidden rounded-full bg-muted"
												role="progressbar"
												aria-label={`${unit.name} mastery`}
												aria-valuemin="0"
												aria-valuemax="100"
												aria-valuenow={unit.mastery}
											>
												<div
													class={cn(
														'h-full rounded-full transition-all',
														performanceBarClass(unit.mastery)
													)}
													style:width={`${unit.mastery}%`}
												></div>
											</div>
											<span
												class={cn(
													'w-11 text-right text-sm font-semibold tabular-nums',
													performanceTextClass(unit.mastery)
												)}
											>
												{unit.mastery}%
											</span>
										</div>
									</div>
									<div class="hidden shrink-0 text-right sm:block">
										<p class="text-sm font-medium">
											{unit.attempts} attempt{unit.attempts === 1 ? '' : 's'}
										</p>
										<p class="mt-1 text-xs text-muted-foreground">
											{formatLastPracticed(unit.lastPracticed)}
										</p>
									</div>
								</button>

								{#if expandedUnit === unit.key}
									<div
										id={`unit-detail-${unit.key}`}
										class="space-y-5 border-t border-border/60 bg-muted/20 px-5 py-5 sm:px-14"
									>
										<div class="grid gap-5 sm:grid-cols-2">
											{#each ['strong', 'developing', 'weak', 'notEnough'] as TopicGroup[] as group (group)}
												<div class="space-y-2">
													<p
														class="text-xs font-medium tracking-wide text-muted-foreground uppercase"
													>
														{topicLabel(group)}
													</p>
													{#if unit.topicGroups[group].length > 0}
														<ul class="space-y-2">
															{#each unit.topicGroups[group] as topic (topic.name)}
																<li class="flex items-start justify-between gap-3 text-sm">
																	<span class="min-w-0">{topic.name}</span>
																	{#if topic.mastery !== null}
																		<span class="shrink-0 font-medium tabular-nums"
																			>{topic.mastery}%</span
																		>
																	{:else}
																		<span class="shrink-0 text-xs text-muted-foreground"
																			>{topic.attempts} attempt{topic.attempts === 1
																				? ''
																				: 's'}</span
																		>
																	{/if}
																</li>
															{/each}
														</ul>
													{:else}
														<p class="text-sm text-muted-foreground">None yet</p>
													{/if}
												</div>
											{/each}
										</div>
										<div
											class="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between"
										>
											<p class="flex items-center gap-2 text-sm text-muted-foreground">
												<Clock3Icon class="size-4" aria-hidden="true" />
												Last practiced {formatLastPracticed(unit.lastPracticed)}
											</p>
											<Button href={practiceHref(unit.name)} variant="outline" size="sm">
												Practice this unit
												<ArrowRightIcon class="size-4" aria-hidden="true" />
											</Button>
										</div>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</Card.Root>
			{/if}
		</section>

		{#if unitCards.some((unit) => unit.recentDelta !== undefined)}
			<section class="space-y-4" aria-labelledby="recent-improvement-heading">
				<div class="space-y-1">
					<h2
						id="recent-improvement-heading"
						class="font-display text-xl font-medium tracking-tight sm:text-2xl"
					>
						Recent improvement
					</h2>
				</div>
				<Card.Root class="rounded-2xl border border-border/60 py-0 shadow-sm ring-0">
					<div class="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
						{#each unitCards.filter((unit) => unit.recentDelta !== undefined) as unit (unit.key)}
							<div class="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3">
								<span class="text-sm font-medium">{unit.name}</span>
								<span
									class={cn(
										'text-sm font-semibold tabular-nums',
										unit.recentDelta! >= 0
											? 'text-emerald-600 dark:text-emerald-400'
											: 'text-rose-600 dark:text-rose-400'
									)}
								>
									{unit.recentDelta! >= 0 ? '+' : ''}{unit.recentDelta}%
								</span>
							</div>
						{/each}
					</div>
				</Card.Root>
			</section>
		{/if}
	</section>
{:else}
	<p class="text-sm text-muted-foreground">Choose a course to start building your mastery view.</p>
{/if}
