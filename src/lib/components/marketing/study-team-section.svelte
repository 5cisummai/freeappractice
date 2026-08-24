<script lang="ts">
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import ArrowRightIcon from '@tabler/icons-svelte/icons/arrow-right';
	import CopyIcon from '@tabler/icons-svelte/icons/copy';
	import FlameIcon from '@tabler/icons-svelte/icons/flame-filled';
	import {
		orgAvatarClass,
		orgAvatarLetter,
		type OrganizationActivityItem,
		type OrganizationLeaderboardEntry,
		type OrganizationSharedSet
	} from '$lib/auth/organization-types';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import SectionIntro from '$lib/components/marketing/section-intro.svelte';
	import { getSiteUrl } from '$lib/site-url';
	import { twAnimateInViewSubtle } from '$lib/tw-animate';
	import { toast } from 'svelte-sonner';

	const mockActivity: OrganizationActivityItem[] = [
		{
			id: 'activity-1',
			userId: 'demo-alex',
			userName: 'Ryan P.',
			apClass: 'AP Biology',
			unit: 'Unit 3',
			scorePercent: 84,
			quizTitle: 'Unit 3 review quiz',
			completedAt: new Date(Date.now() - 2 * 3_600_000).toISOString()
		},
		{
			id: 'activity-2',
			userId: 'demo-jordan',
			userName: 'Gabe O.',
			apClass: 'AP Biology',
			unit: 'Unit 3',
			scorePercent: 76,
			quizTitle: 'Unit 3 review quiz',
			completedAt: new Date(Date.now() - 26 * 3_600_000).toISOString()
		},
		{
			id: 'activity-3',
			userId: 'demo-sam',
			userName: 'Holden T.',
			apClass: 'AP Biology',
			unit: 'Unit 2',
			scorePercent: 91,
			quizTitle: 'Photosynthesis check-in',
			completedAt: new Date(Date.now() - 50 * 3_600_000).toISOString()
		}
	];

	const mockLeaderboard: OrganizationLeaderboardEntry[] = [
		{
			userId: 'demo-priya',
			name: 'Ethan G.',
			image: null,
			questionsLast7Days: 42,
			accuracyPercent: 91,
			unitsPracticed: 4,
			currentStreak: 6
		},
		{
			userId: 'demo-marcus',
			name: 'Angel P.',
			image: null,
			questionsLast7Days: 36,
			accuracyPercent: 84,
			unitsPracticed: 3,
			currentStreak: 4
		},
		{
			userId: 'demo-elena',
			name: 'Lancelot A.',
			image: null,
			questionsLast7Days: 28,
			accuracyPercent: 76,
			unitsPracticed: 2,
			currentStreak: 2
		}
	];

	const mockSharedSets: OrganizationSharedSet[] = [
		{
			id: 'quiz-1',
			slug: 'unit-3-review',
			title: 'Unit 3 review quiz',
			apClass: 'AP Biology',
			unit: 'Unit 3',
			itemCount: 20,
			expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
			createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
			creatorName: 'Alex R.',
			completionCount: 3
		},
		{
			id: 'quiz-2',
			slug: 'photosynthesis-check-in',
			title: 'Photosynthesis check-in',
			apClass: 'AP Biology',
			unit: 'Unit 2',
			itemCount: 12,
			expiresAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
			createdAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
			creatorName: 'Alex R.',
			completionCount: 2
		}
	];

	function activityTarget(item: OrganizationActivityItem): string {
		if (item.quizTitle) return item.quizTitle;
		if (item.unit && item.unit !== 'All Units') return `${item.apClass} — ${item.unit}`;
		return item.apClass;
	}

	function formatRelativeTime(iso: string): string {
		const date = new Date(iso);
		if (Number.isNaN(date.getTime())) return '';

		const diffMs = Date.now() - date.getTime();
		const diffMinutes = Math.floor(diffMs / 60_000);
		if (diffMinutes < 1) return 'Just now';
		if (diffMinutes < 60) return `${diffMinutes}m ago`;

		const diffHours = Math.floor(diffMinutes / 60);
		if (diffHours < 24) return `${diffHours}h ago`;

		const diffDays = Math.floor(diffHours / 24);
		if (diffDays === 1) return 'Yesterday';
		if (diffDays < 7) return `${diffDays}d ago`;

		return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
	}

	async function copyMarketingLink() {
		try {
			const url = `${getSiteUrl(browser ? window.location.origin : undefined)}/`;
			if (!navigator.clipboard?.writeText) {
				throw new Error('Clipboard is not available.');
			}
			await navigator.clipboard.writeText(url);
			toast.success('Link copied.');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not copy link.');
		}
	}

	const cardClass = `flex min-h-0 flex-col overflow-hidden rounded-3xl border border-border bg-background ${twAnimateInViewSubtle}`;
	const captionClass = 'space-y-1 px-6 py-5 sm:px-8 sm:py-6';
	const mockWellClass =
		'relative min-h-0 flex-1 overflow-hidden bg-linear-to-br from-primary/[0.08] via-background to-amber-50/70 p-4 sm:p-5 dark:to-amber-950/20';
	const leaderboardWellClass =
		'relative min-h-0 flex-1 overflow-hidden bg-linear-to-br from-orange-500/10 via-background to-amber-50/70 p-4 sm:p-5 dark:from-orange-500/15 dark:to-amber-950/25';
</script>

<section id="study-as-a-team" class="w-full space-y-12" aria-labelledby="study-as-a-team-heading">
	<div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
		<SectionIntro id="study-as-a-team-heading" class="max-w-2xl">
			{#snippet title()}
				Study as a team
			{/snippet}
			{#snippet description()}
				<p>
					Create a study group, invite classmates, share finished quizzes, and see who is practicing
					in one shared space.
				</p>
			{/snippet}
		</SectionIntro>
		<Button href={resolve('/signup')}>
			Create a study group
			<ArrowRightIcon data-icon="inline-end" />
		</Button>
	</div>

	<div
		class="grid min-h-[52svh] items-stretch gap-4 sm:gap-5 lg:min-h-152 lg:grid-cols-12 lg:grid-rows-2"
	>
		<article class="{cardClass} min-h-72 lg:col-span-7">
			<div class={mockWellClass} aria-hidden="true">
				<Card.Root class="rounded-2xl border border-border/60 py-0 shadow-sm ring-0">
					<ul class="divide-y divide-border/70">
						{#each mockActivity as item (item.id)}
							<li class="flex items-center gap-3 px-5 py-4">
								<span
									class="flex size-9 shrink-0 items-center justify-center rounded-md text-sm font-semibold {orgAvatarClass(
										item.userId
									)}"
								>
									{orgAvatarLetter(item.userName)}
								</span>
								<div class="min-w-0 flex-1">
									<p class="text-sm">
										<span class="font-medium">{item.userName}</span>
										scored
										<span class="font-medium tabular-nums">{item.scorePercent}%</span>
										on
										<span class="font-medium">{activityTarget(item)}</span>
									</p>
									<p class="text-xs text-muted-foreground">
										{formatRelativeTime(item.completedAt)}
									</p>
								</div>
							</li>
						{/each}
					</ul>
				</Card.Root>
			</div>
			<div class={captionClass}>
				<h3 class="text-xl font-semibold tracking-tight">See who's practicing</h3>
				<p class="mt-2 text-sm leading-6 text-muted-foreground">
					Recent scores from members of your active group appear on your dashboard.
				</p>
			</div>
		</article>

		<article class="{cardClass} min-h-72 lg:col-span-5">
			<div class="relative min-h-0 flex-1 overflow-hidden p-4 sm:p-5">
				<div class="rounded-2xl border border-border bg-background shadow-sm">
					<div class="border-b border-border px-4 py-3">
						<p class="text-sm font-semibold">Invite</p>
						<p class="mt-1 text-xs text-muted-foreground">
							Copy a link or email a specific person.
						</p>
					</div>
					<div class="space-y-3 p-4">
						<Button
							type="button"
							variant="outline"
							class="h-9 w-full justify-start gap-2 px-3 text-xs font-medium"
							onclick={copyMarketingLink}
						>
							<CopyIcon class="size-3.5" />
							Copy invite link
						</Button>
						G
						<div class="flex gap-2">
							<div
								class="flex h-9 min-w-0 flex-1 items-center rounded-md border border-border px-3 text-xs text-muted-foreground"
							>
								friend@example.com
							</div>
							<div
								class="flex h-9 shrink-0 items-center rounded-md border border-border bg-background px-3 text-xs font-medium shadow-xs"
							>
								Send invite
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class={captionClass}>
				<h3 class="text-xl font-semibold tracking-tight">Invite your classmates</h3>
				<p class="mt-2 text-sm leading-6 text-muted-foreground">
					Copy a link anyone with an account can use, or send an invite by email.
				</p>
			</div>
		</article>

		<article class="{cardClass} min-h-72 lg:col-span-5">
			<div class="relative min-h-0 flex-1 overflow-hidden p-4 sm:p-5" aria-hidden="true">
				<Card.Root class="rounded-2xl border border-border/60 py-0 shadow-sm ring-0">
					<ul class="divide-y divide-border/70">
						{#each mockSharedSets as quiz (quiz.id)}
							<li class="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
								<div class="min-w-0 flex-1 space-y-1">
									<p class="font-medium">{quiz.title}</p>
									<p class="text-sm text-muted-foreground">
										{quiz.itemCount} questions
										{#if quiz.creatorName}
											· shared by {quiz.creatorName}
										{/if}
										· {quiz.completionCount} completed
									</p>
								</div>
								<Button variant="outline" class="pointer-events-none" tabindex={-1}>
									Practice
									<ArrowRightIcon class="size-4" />
								</Button>
							</li>
						{/each}
					</ul>
				</Card.Root>
			</div>
			<div class={captionClass}>
				<h3 class="text-xl font-semibold tracking-tight">Share study quizzes</h3>
				<p class="mt-2 text-sm leading-6 text-muted-foreground">
					Publish finished practice sets so everyone in the group can take the same quiz.
				</p>
			</div>
		</article>

		<article class="{cardClass} min-h-72 lg:col-span-7">
			<div class={leaderboardWellClass} aria-hidden="true">
				<Card.Root class="rounded-2xl border border-border/60 py-0 shadow-sm ring-0">
					<div class="overflow-x-auto">
						<table class="w-full min-w-xl text-sm">
							<thead class="border-b border-border/70 text-left text-muted-foreground">
								<tr>
									<th class="px-5 py-3 font-medium">Member</th>
									<th class="px-3 py-3 font-medium">7-day questions</th>
									<th class="px-3 py-3 font-medium">Accuracy</th>
									<th class="px-3 py-3 font-medium">Units</th>
									<th class="px-5 py-3 font-medium">Streak</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-border/70">
								{#each mockLeaderboard as entry, index (entry.userId)}
									<tr>
										<td class="px-5 py-3">
											<div class="flex items-center gap-3">
												<span class="w-5 text-xs font-medium text-muted-foreground tabular-nums">
													{index + 1}
												</span>
												<span
													class="flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold {orgAvatarClass(
														entry.userId
													)}"
												>
													{orgAvatarLetter(entry.name)}
												</span>
												<span class="font-medium">{entry.name}</span>
											</div>
										</td>
										<td class="px-3 py-3 tabular-nums">{entry.questionsLast7Days}</td>
										<td class="px-3 py-3 tabular-nums">
											{entry.accuracyPercent === null ? '—' : `${entry.accuracyPercent}%`}
										</td>
										<td class="px-3 py-3 tabular-nums">{entry.unitsPracticed}</td>
										<td class="px-5 py-3">
											<div class="flex items-center gap-1.5 text-orange-500">
												<FlameIcon class="size-4" />
												<span class="tabular-nums">{entry.currentStreak}</span>
											</div>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</Card.Root>
			</div>
			<div class={captionClass}>
				<h3 class="text-xl font-semibold tracking-tight">Friendly competition</h3>
				<p class="mt-2 text-sm leading-6 text-muted-foreground">
					See who answered the most questions this week, who has the best accuracy, and who is on a
					streak.
				</p>
			</div>
		</article>
	</div>
</section>
