<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { auth, apiFetch } from '$lib/client/auth.svelte.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import BarChart3Icon from '@lucide/svelte/icons/bar-chart-3';
	import FlameIcon from '@lucide/svelte/icons/flame';
	import TargetIcon from '@lucide/svelte/icons/target';
	import TrendingUpIcon from '@lucide/svelte/icons/trending-up';
	import ClockIcon from '@lucide/svelte/icons/clock';

	interface StatsData {
		overview: {
			totalQuestions: number;
			correctAnswers: number;
			accuracy: number;
			currentStreak: number;
			totalTimeHours: number;
			memberSince: string;
		};
		recentPerformance: {
			questionsLast7Days: number;
			accuracyLast7Days: number;
		};
		subjectBreakdown: Array<{
			subject: string;
			total: number;
			correct: number;
			accuracy: number;
			avgTimeSeconds: number;
		}>;
	}

	interface ProgressEntry {
		apClass: string;
		unit: string;
		totalAttempts: number;
		mastery: number;
	}

	let statsData = $state<StatsData | null>(null);
	let progressData = $state<ProgressEntry[]>([]);
	let loading = $state(true);

	const nextBestUnit = $derived(() => {
		if (!progressData.length) return null;
		return (
			[...progressData]
				.filter((entry) => !!entry.apClass)
				.sort((a, b) => a.mastery - b.mastery || a.totalAttempts - b.totalAttempts)[0] ?? null
		);
	});

	const recommendedPracticeHref = $derived(() => {
		const recommendation = nextBestUnit();
		if (!recommendation) return resolve('/app/practice');
		const basePath = resolve('/app/practice');
		const classParam = `apClass=${encodeURIComponent(recommendation.apClass)}`;
		const unitParam = recommendation.unit ? `&unit=${encodeURIComponent(recommendation.unit)}` : '';
		return `${basePath}?${classParam}${unitParam}`;
	});

	onMount(async () => {
		try {
			const [statsRes, progressRes] = await Promise.all([
				apiFetch('/api/auth/stats'),
				apiFetch('/api/auth/progress')
			]);
			if (statsRes.ok) {
				statsData = await statsRes.json();
			}
			if (progressRes.ok) {
				const data = await progressRes.json();
				progressData = data.progress ?? [];
			}
		} catch {
			// Stats are optional
		} finally {
			loading = false;
		}
	});
</script>

<div class="mx-auto w-full max-w-5xl space-y-8 px-5 py-8 sm:px-8 lg:px-10">
	<!-- Welcome -->
	<div class="space-y-1">
		<h1 class="text-2xl font-semibold tracking-tight">
			Welcome back, {auth.user?.name?.split(' ')[0] ?? 'Student'}
		</h1>
		<p class="text-sm text-muted-foreground">Here's an overview of your study progress.</p>
	</div>

	{#if loading}
		<div class="flex justify-center py-16">
			<Spinner />
		</div>
	{:else}
		<!-- Study plan -->
		<Card.Root class="border-primary/30 bg-primary/3 p-5">
			<div class="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
				<div class="space-y-1.5">
					<p class="text-sm font-medium text-primary">Your Next Best Unit</p>
					{#if nextBestUnit()}
						<p class="text-base font-semibold">
							{nextBestUnit()?.apClass}
							{#if nextBestUnit()?.unit}
								- {nextBestUnit()?.unit}
							{/if}
						</p>
						<p class="text-sm text-muted-foreground">
							Mastery {nextBestUnit()?.mastery}% across {nextBestUnit()?.totalAttempts} attempts.
						</p>
					{:else}
						<p class="text-base font-semibold">Start your first focused practice session</p>
						<p class="text-sm text-muted-foreground">
							We'll personalize this recommendation once you complete a few attempts.
						</p>
					{/if}
				</div>
				<Button href={recommendedPracticeHref()}>Start Recommended Practice</Button>
			</div>
		</Card.Root>

		<!-- Stats grid -->
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
			<Card.Root class="p-4">
				<div class="flex items-center gap-3">
					<div
						class="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"
					>
						<BookOpenIcon class="h-4 w-4" />
					</div>
					<div>
						<p class="text-2xl font-bold">{statsData?.overview.totalQuestions ?? 0}</p>
						<p class="text-xs text-muted-foreground">Questions</p>
					</div>
				</div>
			</Card.Root>
			<Card.Root class="p-4">
				<div class="flex items-center gap-3">
					<div
						class="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500"
					>
						<TargetIcon class="h-4 w-4" />
					</div>
					<div>
						<p class="text-2xl font-bold">{statsData?.overview.accuracy ?? 0}%</p>
						<p class="text-xs text-muted-foreground">Accuracy</p>
					</div>
				</div>
			</Card.Root>
			<Card.Root class="p-4">
				<div class="flex items-center gap-3">
					<div
						class="flex size-9 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500"
					>
						<FlameIcon class="h-4 w-4" />
					</div>
					<div>
						<p class="text-2xl font-bold">{statsData?.overview.currentStreak ?? 0}</p>
						<p class="text-xs text-muted-foreground">Day Streak</p>
					</div>
				</div>
			</Card.Root>
			<Card.Root class="p-4">
				<div class="flex items-center gap-3">
					<div
						class="flex size-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500"
					>
						<TrendingUpIcon class="h-4 w-4" />
					</div>
					<div>
						<p class="text-2xl font-bold">
							{statsData?.recentPerformance?.questionsLast7Days ?? 0}
						</p>
						<p class="text-xs text-muted-foreground">Last 7 Days</p>
					</div>
				</div>
			</Card.Root>
		</div>

		<!-- Quick actions -->
		<div>
			<h2 class="mb-4 text-lg font-semibold">Quick Actions</h2>
			<div class="grid gap-4 sm:grid-cols-2">
				<a href={resolve('/app/practice')} class="block">
					<Card.Root class="flex items-center gap-4 p-5 transition-colors hover:bg-muted/40">
						<div
							class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
						>
							<BookOpenIcon class="h-5 w-5" />
						</div>
						<div>
							<p class="font-medium">Start Practicing</p>
							<p class="text-sm text-muted-foreground">
								Generate questions and test your knowledge
							</p>
						</div>
					</Card.Root>
				</a>
				<a href={resolve('/app/progress')} class="block">
					<Card.Root class="flex items-center gap-4 p-5 transition-colors hover:bg-muted/40">
						<div
							class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500"
						>
							<BarChart3Icon class="h-5 w-5" />
						</div>
						<div>
							<p class="font-medium">View Progress</p>
							<p class="text-sm text-muted-foreground">
								Track mastery across AP subjects and units
							</p>
						</div>
					</Card.Root>
				</a>
			</div>
		</div>

		<!-- Subject breakdown -->
		{#if statsData?.subjectBreakdown && statsData.subjectBreakdown.length > 0}
			<div>
				<h2 class="mb-4 text-lg font-semibold">Subject Performance</h2>
				<Card.Root>
					<div class="divide-y divide-border">
						{#each statsData.subjectBreakdown as subject (subject.subject)}
							<div class="flex items-center gap-4 px-5 py-3.5">
								<div class="min-w-0 flex-1">
									<p class="truncate text-sm font-medium">{subject.subject}</p>
									<p class="text-xs text-muted-foreground">{subject.total} questions</p>
								</div>
								<div class="flex items-center gap-3 text-right">
									<div class="w-24">
										<div class="h-2 w-full overflow-hidden rounded-full bg-muted">
											<div
												class="h-full rounded-full bg-primary transition-all"
												style="width: {subject.accuracy}%"
											></div>
										</div>
									</div>
									<span class="w-12 text-sm font-medium tabular-nums">{subject.accuracy}%</span>
								</div>
								{#if subject.avgTimeSeconds}
									<div class="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
										<ClockIcon class="h-3 w-3" />
										<span>{Math.round(subject.avgTimeSeconds)}s avg</span>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</Card.Root>
			</div>
		{/if}

		<!-- Empty state -->
		{#if !statsData || statsData.overview.totalQuestions === 0}
			<Card.Root class="border-dashed p-10 text-center">
				<BookOpenIcon class="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
				<p class="font-medium">No practice sessions yet</p>
				<p class="mt-1 text-sm text-muted-foreground">Start practicing to see your stats here.</p>
				<div class="mt-4">
					<Button href={resolve('/app/practice')}>Start Practicing</Button>
				</div>
			</Card.Root>
		{/if}
	{/if}
</div>
