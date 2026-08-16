<script lang="ts">
	import { resolve } from '$app/paths';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import UsersIcon from '@lucide/svelte/icons/users';
	import { Button } from '$lib/components/ui/button/index.js';
	import SectionIntro from '$lib/components/marketing/section-intro.svelte';
	import { twAnimateInViewSubtle } from '$lib/tw-animate';

	const members = [
		{ initials: 'AR', color: 'bg-sky-200 text-sky-900 dark:bg-sky-900 dark:text-sky-100' },
		{ initials: 'JM', color: 'bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100' },
		{
			initials: 'SK',
			color: 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100'
		},
		{ initials: '+1', color: 'bg-muted text-muted-foreground' }
	];

	const activity = [
		{
			initials: 'AR',
			name: 'Alex R.',
			score: '84%',
			target: 'AP Biology · Unit 3',
			time: '2h ago',
			color: members[0].color
		},
		{
			initials: 'JM',
			name: 'Jordan M.',
			score: '76%',
			target: 'AP Biology · Unit 3',
			time: 'Yesterday',
			color: members[1].color
		},
		{
			initials: 'SK',
			name: 'Sam K.',
			score: '91%',
			target: 'AP Biology · Unit 2',
			time: '2d ago',
			color: members[2].color
		}
	];

	const cardClass = `flex min-h-0 flex-col overflow-hidden rounded-3xl border border-border bg-background ${twAnimateInViewSubtle}`;
	const captionClass = 'space-y-1 px-8 py-6';
	const mockCardClass = 'rounded-2xl border border-border bg-background';
</script>

<section id="study-as-a-team" class="w-full space-y-12" aria-labelledby="study-as-a-team-heading">
	<SectionIntro id="study-as-a-team-heading">
		{#snippet title()}
			Study as a team
		{/snippet}
		{#snippet description()}
			<p>
				Create an organization for your class or study group, invite classmates, and see recent quiz
				activity in one shared space.
			</p>
		{/snippet}
	</SectionIntro>

	<div
		class="grid min-h-[52svh] items-stretch gap-4 sm:gap-5 lg:min-h-152 lg:grid-cols-12 lg:grid-rows-2"
	>
		<article class="{cardClass} min-h-112 lg:col-span-7 lg:row-span-2">
			<div
				class="relative min-h-0 flex-1 overflow-hidden bg-linear-to-br from-primary/[0.08] via-background to-amber-50/70 p-4 sm:p-5 dark:to-amber-950/20"
				aria-hidden="true"
			>
				<div class="{mockCardClass} overflow-hidden shadow-sm">
					<div class="flex items-center gap-2 border-b border-border px-4 py-3">
						<UsersIcon class="size-4 text-muted-foreground" />
						<p class="text-sm font-semibold">Group activity</p>
					</div>
					<ul class="divide-y divide-border">
						{#each activity as item (item.name)}
							<li class="flex items-center gap-3 px-4 py-3">
								<span
									class="flex size-9 shrink-0 items-center justify-center rounded-md text-xs font-semibold {item.color}"
								>
									{item.initials}
								</span>
								<div class="min-w-0 flex-1">
									<p class="text-xs leading-5">
										<span class="font-medium">{item.name}</span> scored
										<span class="font-medium tabular-nums">{item.score}</span> on
										<span class="font-medium">{item.target}</span>
									</p>
									<p class="text-[0.65rem] text-muted-foreground">{item.time}</p>
								</div>
							</li>
						{/each}
					</ul>
				</div>
			</div>
			<div class={captionClass}>
				<h3 class="text-xl font-semibold tracking-tight">See who's practicing</h3>
				<p class="mt-2 text-sm leading-6 text-muted-foreground">
					Recent quiz scores from members of your active group appear on your dashboard.
				</p>
				<Button href={resolve('/signup')} class="mt-4 w-fit rounded-full">
					Create a study group
					<ArrowRightIcon data-icon="inline-end" />
				</Button>
			</div>
		</article>

		<article class="{cardClass} min-h-72 lg:col-span-5">
			<div class="relative min-h-52 flex-1 overflow-hidden p-4 sm:p-5" aria-hidden="true">
				<div class="{mockCardClass} overflow-hidden shadow-sm">
					<div class="border-b border-border px-4 py-3">
						<p class="text-sm font-semibold">Invite</p>
						<p class="mt-1 text-xs text-muted-foreground">
							Copy a link or email a specific person.
						</p>
					</div>
					<div class="space-y-3 p-4">
						<div
							class="flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-xs font-medium shadow-xs"
						>
							<CopyIcon class="size-3.5" />
							Copy invite link
						</div>
						<div class="flex gap-2">
							<div
								class="flex h-9 min-w-0 flex-1 items-center rounded-md border border-border px-3 text-xs text-muted-foreground"
							>
								friend@example.com
							</div>
							<div
								class="flex h-9 shrink-0 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground"
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
			<div class="relative min-h-52 flex-1 overflow-hidden p-4 sm:p-5" aria-hidden="true">
				<div class="{mockCardClass} overflow-hidden shadow-sm">
					<div class="flex items-center gap-2 border-b border-border px-3 py-2.5">
						<span
							class="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary"
						>
							A
						</span>
						<span class="min-w-0 flex-1 truncate text-xs font-medium">AP Biology study group</span>
						<ChevronsUpDownIcon class="size-3.5 shrink-0 text-muted-foreground" />
					</div>
					<div class="space-y-1 p-2">
						<div class="flex items-center gap-2 rounded-md px-2 py-2">
							<span
								class="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-[0.65rem] font-semibold"
							>
								M
							</span>
							<span class="min-w-0 flex-1 truncate text-xs">My Space</span>
						</div>
						<div class="flex items-center gap-2 rounded-md bg-muted/50 px-2 py-2">
							<span
								class="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[0.65rem] font-semibold text-primary"
							>
								A
							</span>
							<span class="min-w-0 flex-1 truncate text-xs">AP Biology study group</span>
							<CheckIcon class="size-3.5 shrink-0" />
						</div>
						<div class="mt-1 flex items-center gap-2 border-t border-border px-2 pt-2 text-xs">
							<PlusIcon class="size-3.5" />
							Create organization
						</div>
					</div>
				</div>
			</div>
			<div class={captionClass}>
				<h3 class="text-xl font-semibold tracking-tight">Switch between organizations</h3>
				<p class="mt-2 text-sm leading-6 text-muted-foreground">
					Keep class and friend groups separate while managing them from one account.
				</p>
			</div>
		</article>
	</div>
</section>
