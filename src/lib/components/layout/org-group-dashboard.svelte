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

<section class="space-y-4" aria-labelledby="my-group-heading">
	<h2 id="my-group-heading" class="font-display text-xl font-medium tracking-tight sm:text-2xl">
		My Group
	</h2>

	<div class="grid gap-4 lg:grid-cols-2">
		<section class="min-w-0 space-y-3" aria-labelledby="group-quizzes-heading">
			<div class="flex items-center gap-2">
				<BookOpenIcon class="size-4 text-muted-foreground" aria-hidden="true" />
				<h3 id="group-quizzes-heading" class="text-sm font-medium">Group quizzes</h3>
			</div>

			<Card.Root class="rounded-2xl border border-border/60 py-0 shadow-sm ring-0">
				{#if orgSharedSets.length > 0}
					<ul class="divide-y divide-border/70">
						{#each orgSharedSets as quiz (quiz.id)}
							<li class="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:px-5">
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
								<Button href={sharedSetHref(quiz.slug)} size="sm" class="shrink-0">
									Practice
									<ArrowRightIcon class="size-4" />
								</Button>
							</li>
						{/each}
					</ul>
				{:else}
					<div class="px-4 py-5 text-sm text-muted-foreground sm:px-5 sm:py-6">
						No group quizzes yet. Owners and admins can share a finished practice quiz with the
						group.
					</div>
				{/if}
			</Card.Root>
		</section>

		<section class="min-w-0 space-y-3" aria-labelledby="group-leaderboard-heading">
			<div class="flex items-center gap-2">
				<TrophyIcon class="size-4 text-muted-foreground" aria-hidden="true" />
				<h3 id="group-leaderboard-heading" class="text-sm font-medium">Leaderboard</h3>
			</div>

			<Card.Root class="rounded-2xl border border-border/60 py-0 shadow-sm ring-0">
				{#if orgLeaderboard.length > 0}
					<div class="overflow-x-auto">
						<table class="w-full min-w-[28rem] text-sm">
							<thead class="border-b border-border/70 text-left text-muted-foreground">
								<tr>
									<th class="px-4 py-3 font-medium sm:px-5">Member</th>
									<th class="px-2 py-3 font-medium">7d</th>
									<th class="px-2 py-3 font-medium">Acc.</th>
									<th class="px-2 py-3 font-medium">Units</th>
									<th class="px-4 py-3 font-medium sm:px-5">Streak</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-border/70">
								{#each orgLeaderboard as entry, index (entry.userId)}
									<tr>
										<td class="px-4 py-3 sm:px-5">
											<div class="flex items-center gap-2.5">
												<span class="w-4 text-xs font-medium text-muted-foreground tabular-nums">
													{index + 1}
												</span>
												{#if entry.image}
													<img
														src={entry.image}
														alt=""
														class="size-7 rounded-md object-cover"
													/>
												{:else}
													<span
														class="flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold {orgAvatarClass(
															entry.userId
														)}"
													>
														{orgAvatarLetter(entry.name)}
													</span>
												{/if}
												<span class="ph-mask-pii truncate font-medium">{entry.name}</span>
											</div>
										</td>
										<td class="px-2 py-3 tabular-nums">{entry.questionsLast7Days}</td>
										<td class="px-2 py-3 tabular-nums">
											{entry.accuracyPercent === null ? '—' : `${entry.accuracyPercent}%`}
										</td>
										<td class="px-2 py-3 tabular-nums">{entry.unitsPracticed}</td>
										<td class="px-4 py-3 sm:px-5">
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
					<div class="px-4 py-5 text-sm text-muted-foreground sm:px-5 sm:py-6">
						Practice questions to appear on the leaderboard.
					</div>
				{/if}
			</Card.Root>
		</section>
	</div>

	<section class="space-y-3" aria-labelledby="group-activity-heading">
		<div class="flex items-center gap-2">
			<UsersIcon class="size-4 text-muted-foreground" aria-hidden="true" />
			<h3 id="group-activity-heading" class="text-sm font-medium">Recent activity</h3>
		</div>

		<Card.Root class="rounded-2xl border border-border/60 py-0 shadow-sm ring-0">
			{#if orgActivity.length > 0}
				<ul class="divide-y divide-border/70">
					{#each orgActivity as item (item.id)}
						<li class="flex items-center gap-3 px-4 py-3.5 sm:px-5 sm:py-4">
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
				<div class="px-4 py-5 text-sm text-muted-foreground sm:px-5 sm:py-6">
					No quiz activity in the last two weeks. Finish a practice quiz to show up here.
				</div>
			{/if}
		</Card.Root>
	</section>
</section>
