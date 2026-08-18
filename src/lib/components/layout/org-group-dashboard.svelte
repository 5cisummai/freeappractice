<script lang="ts">
	import { resolve } from '$app/paths';
	import ArrowRightIcon from '@tabler/icons-svelte/icons/arrow-right';
	import BookOpenIcon from '@tabler/icons-svelte/icons/book-filled';
	import FlameIcon from '@tabler/icons-svelte/icons/flame-filled';
	import TrophyIcon from '@tabler/icons-svelte/icons/trophy-filled';
	import UsersIcon from '@tabler/icons-svelte/icons/users';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import {
		orgAvatarClass,
		orgAvatarLetter,
		type OrganizationActivityItem,
		type OrganizationLeaderboardEntry,
		type OrganizationSharedSet
	} from '$lib/auth/organization-types';

	let {
		orgActivity = [],
		orgSharedSets = [],
		orgLeaderboard = []
	}: {
		orgActivity?: OrganizationActivityItem[];
		orgSharedSets?: OrganizationSharedSet[];
		orgLeaderboard?: OrganizationLeaderboardEntry[];
	} = $props();

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

	function sharedSetHref(slug: string): string {
		return `${resolve('/app/practice')}?shared=${encodeURIComponent(slug)}`;
	}
</script>

<section class="space-y-8">
	<section class="space-y-4" aria-labelledby="group-quizzes-heading">
		<div class="flex items-center gap-2">
			<BookOpenIcon class="size-5 text-muted-foreground" aria-hidden="true" />
			<h2
				id="group-quizzes-heading"
				class="font-display text-xl font-medium tracking-tight sm:text-2xl"
			>
				Group quizzes
			</h2>
		</div>

		<Card.Root class="rounded-2xl border border-border/60 py-0 shadow-sm ring-0">
			{#if orgSharedSets.length > 0}
				<ul class="divide-y divide-border/70">
					{#each orgSharedSets as quiz (quiz.id)}
						<li class="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
							<div class="min-w-0 flex-1 space-y-1">
								<p class="font-medium">{quiz.title}</p>
								<p class="text-sm text-muted-foreground">
									{quiz.itemCount} questions
									{#if quiz.creatorName}
										· shared by <span class="ph-mask-pii">{quiz.creatorName}</span>
									{/if}
									· {quiz.completionCount} completed
								</p>
							</div>
							<Button href={sharedSetHref(quiz.slug)}>
								Practice
								<ArrowRightIcon class="size-4" />
							</Button>
						</li>
					{/each}
				</ul>
			{:else}
				<div class="px-5 py-6 text-sm text-muted-foreground">
					No group quizzes yet. Owners and admins can share a finished practice quiz with the group.
				</div>
			{/if}
		</Card.Root>
	</section>

	<section class="space-y-4" aria-labelledby="group-leaderboard-heading">
		<div class="flex items-center gap-2">
			<TrophyIcon class="size-5 text-muted-foreground" aria-hidden="true" />
			<h2
				id="group-leaderboard-heading"
				class="font-display text-xl font-medium tracking-tight sm:text-2xl"
			>
				Leaderboard
			</h2>
		</div>

		<Card.Root class="rounded-2xl border border-border/60 py-0 shadow-sm ring-0">
			{#if orgLeaderboard.length > 0}
				<div class="overflow-x-auto">
					<table class="w-full min-w-[36rem] text-sm">
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
							{#each orgLeaderboard as entry, index (entry.userId)}
								<tr>
									<td class="px-5 py-3">
										<div class="flex items-center gap-3">
											<span class="w-5 text-xs font-medium text-muted-foreground tabular-nums">
												{index + 1}
											</span>
											{#if entry.image}
												<img src={entry.image} alt="" class="size-8 rounded-md object-cover" />
											{:else}
												<span
													class="flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold {orgAvatarClass(
														entry.userId
													)}"
												>
													{orgAvatarLetter(entry.name)}
												</span>
											{/if}
											<span class="ph-mask-pii font-medium">{entry.name}</span>
										</div>
									</td>
									<td class="px-3 py-3 tabular-nums">{entry.questionsLast7Days}</td>
									<td class="px-3 py-3 tabular-nums">
										{entry.accuracyPercent === null ? '—' : `${entry.accuracyPercent}%`}
									</td>
									<td class="px-3 py-3 tabular-nums">{entry.unitsPracticed}</td>
									<td class="px-5 py-3">
										<div class="flex items-center gap-1.5 text-orange-500">
											<FlameIcon class="size-4" aria-hidden="true" />
											<span class="tabular-nums">{entry.currentStreak}</span>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<div class="px-5 py-6 text-sm text-muted-foreground">
					Practice questions to appear on the leaderboard.
				</div>
			{/if}
		</Card.Root>
	</section>

	<section class="space-y-4" aria-labelledby="group-activity-heading">
		<div class="flex items-center gap-2">
			<UsersIcon class="size-5 text-muted-foreground" aria-hidden="true" />
			<h2
				id="group-activity-heading"
				class="font-display text-xl font-medium tracking-tight sm:text-2xl"
			>
				Recent activity
			</h2>
		</div>

		<Card.Root class="rounded-2xl border border-border/60 py-0 shadow-sm ring-0">
			{#if orgActivity.length > 0}
				<ul class="divide-y divide-border/70">
					{#each orgActivity as item (item.id)}
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
									<span class="ph-mask-pii font-medium">{item.userName}</span>
									scored
									<span class="font-medium tabular-nums">{item.scorePercent}%</span>
									on
									<span class="font-medium">{activityTarget(item)}</span>
								</p>
								<p class="text-xs text-muted-foreground">
									<time datetime={item.completedAt}>{formatRelativeTime(item.completedAt)}</time>
								</p>
							</div>
						</li>
					{/each}
				</ul>
			{:else}
				<div class="px-5 py-6 text-sm text-muted-foreground">
					No quiz activity in the last two weeks. Finish a practice quiz to show up here.
				</div>
			{/if}
		</Card.Root>
	</section>
</section>
