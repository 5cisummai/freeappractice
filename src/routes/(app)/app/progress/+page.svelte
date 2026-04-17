<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { apiFetch } from '$lib/client/auth.svelte.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';

	interface ProgressEntry {
		apClass: string;
		unit: string;
		totalAttempts: number;
		correctAttempts: number;
		mastery: number;
		lastAttemptAt?: string;
	}

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

	let progressData = $state<ProgressEntry[]>([]);
	let statsData = $state<StatsData | null>(null);
	let loading = $state(true);
	let errorMessage = $state('');

	onMount(async () => {
		try {
			const [progressRes, statsRes] = await Promise.all([
				apiFetch('/api/auth/progress'),
				apiFetch('/api/auth/stats')
			]);
			if (progressRes.ok) {
				const d = await progressRes.json();
				progressData = d.progress ?? [];
			}
			if (statsRes.ok) {
				statsData = await statsRes.json();
			}
		} catch {
			errorMessage = 'Failed to load progress data.';
		} finally {
			loading = false;
		}
	});

	const grouped = $derived(() => {
		const map: Record<string, ProgressEntry[]> = {};
		for (const p of progressData) {
			if (!map[p.apClass]) map[p.apClass] = [];
			map[p.apClass].push(p);
		}
		return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
	});
</script>

<div class="mx-auto w-full max-w-5xl space-y-8 px-5 py-8 sm:px-8 lg:px-10">
	<div class="space-y-1">
		<h1 class="text-2xl font-semibold tracking-tight">Your Progress</h1>
		<p class="text-sm text-muted-foreground">Track your performance across all AP subjects.</p>
	</div>

	{#if loading}
		<div class="flex justify-center py-16">
			<Spinner />
		</div>
	{:else if errorMessage}
		<p class="text-sm text-destructive">{errorMessage}</p>
	{:else}
		<!-- Overview stats -->
		{#if statsData}
			<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
				<Card.Root class="p-4 text-center">
					<p class="text-2xl font-bold">{statsData.overview.totalQuestions}</p>
					<p class="mt-1 text-xs text-muted-foreground">Questions Answered</p>
				</Card.Root>
				<Card.Root class="p-4 text-center">
					<p class="text-2xl font-bold">{statsData.overview.accuracy}%</p>
					<p class="mt-1 text-xs text-muted-foreground">Overall Accuracy</p>
				</Card.Root>
				<Card.Root class="p-4 text-center">
					<p class="text-2xl font-bold">{statsData.overview.currentStreak}</p>
					<p class="mt-1 text-xs text-muted-foreground">Day Streak</p>
				</Card.Root>
				<Card.Root class="p-4 text-center">
					<p class="text-2xl font-bold">{statsData.recentPerformance.questionsLast7Days}</p>
					<p class="mt-1 text-xs text-muted-foreground">Last 7 Days</p>
				</Card.Root>
			</div>
		{/if}

		<!-- Per-subject breakdown -->
		{#if grouped().length === 0}
			<div class="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
				<p>No progress yet. Go practice some questions!</p>
				<a
					href={resolve('/app/practice')}
					class="mt-4 inline-block text-sm underline underline-offset-4">Start practicing →</a
				>
			</div>
		{:else}
			<div class="space-y-6">
				{#each grouped() as [apClass, units] (apClass)}
					<Card.Root>
						<Card.Header>
							<Card.Title>{apClass}</Card.Title>
						</Card.Header>
						<Card.Content>
							<div class="space-y-3">
								{#each units as unit (`${apClass}:${unit.unit || 'all-units'}`)}
									<div class="flex items-center gap-4">
										<div class="min-w-0 flex-1">
											<p class="truncate text-sm font-medium">{unit.unit || 'All Units'}</p>
											<p class="text-xs text-muted-foreground">{unit.totalAttempts} attempts</p>
										</div>
										<div class="w-32">
											<div class="mb-1 flex justify-between text-xs text-muted-foreground">
												<span>Mastery</span>
												<span>{unit.mastery}%</span>
											</div>
											<div class="h-2 w-full overflow-hidden rounded-full bg-muted">
												<div
													class="h-full rounded-full bg-primary transition-all"
													style="width: {unit.mastery}%"
												></div>
											</div>
										</div>
									</div>
								{/each}
							</div>
						</Card.Content>
					</Card.Root>
				{/each}
			</div>
		{/if}
	{/if}
</div>
