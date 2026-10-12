<script lang="ts">
	import CoachChatDemo from '$lib/components/marketing/coach-chat-demo.svelte';
	import SectionIntro from '$lib/components/marketing/section-intro.svelte';
	import { twAnimateInViewSubtle } from '$lib/tw-animate';
	import BookOpenIcon from '@tabler/icons-svelte/icons/book-filled';
	import PlayerPlayFilledIcon from '@tabler/icons-svelte/icons/player-play-filled';

	const planTasks = [
		{
			label: 'AP Biology · Unit 3',
			meta: 'Aug 11 · 20 min · MCQ',
			done: true
		},
		{
			label: 'AP Calculus AB · Unit 2',
			meta: 'Aug 12 · 25 min · MCQ',
			done: false
		},
		{
			label: 'AP Chemistry · Unit 4',
			meta: 'Aug 13 · 30 min · FRQ',
			done: false
		}
	];

	const wellClass = 'relative min-h-0 flex-1 overflow-hidden';
	const cardClass =
		'flex min-h-0 flex-col overflow-hidden rounded-3xl border border-border bg-muted/50';
	const coachCardClass =
		'flex min-h-0 flex-col overflow-hidden rounded-3xl border border-border bg-background';
	const captionClass = 'space-y-1 px-8 py-6';
</script>

<section id="super" class="w-full space-y-12" aria-labelledby="super-section-heading">
	<SectionIntro id="super-section-heading">
		{#snippet title()}
			Intelligent coaching built around
			<span class="relative inline-block px-1">
				you<svg
					class="pointer-events-none absolute -bottom-1 left-0 h-3 w-full text-primary"
					viewBox="0 0 88 10"
					fill="none"
					aria-hidden="true"
				>
					<path
						d="M2 7.2c12.5-3.8 26.4 1.6 39.2-.4C54.2 5 66.8 2.1 86 6.4"
						stroke="currentColor"
						stroke-width="2.6"
						stroke-linecap="round"
					/>
				</svg>
			</span>
		{/snippet}
		{#snippet description()}
			<p>
				Supercharge your studying with personalized intelligence that learns from your context to
				give you the next best steps.
			</p>
		{/snippet}
	</SectionIntro>

	<div
		class="grid min-h-[52svh] items-stretch gap-4 sm:gap-5 lg:min-h-152 lg:grid-cols-12 lg:grid-rows-2"
	>
		<article class="{coachCardClass} min-h-112 lg:col-span-7 lg:row-span-2 {twAnimateInViewSubtle}">
			<div class="{wellClass} bg-background" aria-hidden="true">
				<CoachChatDemo />
			</div>
		</article>

		<article class="{cardClass} min-h-72 {twAnimateInViewSubtle} lg:col-span-5">
			<div class="{wellClass} min-h-52 p-4 sm:p-5" aria-hidden="true">
				<div
					class="pointer-events-none flex h-full min-h-44 flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm ring-1 ring-foreground/10"
				>
					<div
						class="flex items-center justify-between gap-2 border-b border-border bg-neutral-50 px-3 py-2"
					>
						<div class="flex min-w-0 items-center gap-2">
							<span class="size-2 shrink-0 rounded-full bg-emerald-500"></span>
							<p class="truncate text-[0.7rem] font-medium text-neutral-800">Projectile Motion</p>
						</div>
						<div class="flex shrink-0 items-center gap-1">
							<span
								class="rounded-md bg-primary px-1.5 py-0.5 text-[0.6rem] font-medium text-primary-foreground"
								>Physics</span
							>
							<span class="rounded-md px-1.5 py-0.5 text-[0.6rem] font-medium text-neutral-400"
								>Math</span
							>
						</div>
					</div>
					<div class="relative flex-1 bg-neutral-50/80">
						<svg
							class="absolute inset-0 h-full w-full"
							viewBox="0 0 320 140"
							fill="none"
							preserveAspectRatio="xMidYMid slice"
							aria-hidden="true"
						>
							<line
								x1="16"
								y1="118"
								x2="304"
								y2="118"
								stroke="rgba(15,23,42,0.12)"
								stroke-width="1"
							/>
							<path
								d="M 40 118 Q 120 20 200 118"
								stroke="rgba(14,165,233,0.35)"
								stroke-width="2"
								stroke-dasharray="4 3"
								fill="none"
							/>
							<path
								d="M 40 118 Q 160 8 280 118"
								stroke="rgb(2,132,199)"
								stroke-width="2.5"
								fill="none"
							/>
							<line
								x1="40"
								y1="118"
								x2="88"
								y2="78"
								stroke="rgba(217,119,6,0.75)"
								stroke-width="1.5"
								stroke-dasharray="3 2"
							/>
							<circle cx="168" cy="42" r="5" fill="rgb(2,132,199)" />
							<circle cx="40" cy="118" r="4" fill="rgb(217,119,6)" />
						</svg>
					</div>
					<div class="space-y-2.5 border-t border-border bg-white px-3 py-2.5">
						<div class="flex items-center gap-2">
							<span
								class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm"
							>
								<PlayerPlayFilledIcon class="size-3.5" />
							</span>
							<div class="min-w-0 flex-1 space-y-2">
								<div class="flex items-center gap-2">
									<span class="w-14 shrink-0 text-[0.6rem] text-neutral-500">Angle</span>
									<div class="relative h-1.5 flex-1 rounded-full bg-neutral-200">
										<div class="absolute inset-y-0 left-0 w-[55%] rounded-full bg-sky-500"></div>
										<div
											class="absolute top-1/2 left-[55%] size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-600/20 bg-white shadow-sm"
										></div>
									</div>
									<span class="w-7 shrink-0 text-right text-[0.6rem] font-medium text-neutral-700"
										>45°</span
									>
								</div>
								<div class="flex items-center gap-2">
									<span class="w-14 shrink-0 text-[0.6rem] text-neutral-500">Speed</span>
									<div class="relative h-1.5 flex-1 rounded-full bg-neutral-200">
										<div class="absolute inset-y-0 left-0 w-[72%] rounded-full bg-sky-500"></div>
										<div
											class="absolute top-1/2 left-[72%] size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-600/20 bg-white shadow-sm"
										></div>
									</div>
									<span class="w-7 shrink-0 text-right text-[0.6rem] font-medium text-neutral-700"
										>18</span
									>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class={captionClass}>
				<h3 class="text-xl font-semibold tracking-tight">Learn with Physics and Math Sims</h3>
				<p class="mt-2 text-sm leading-6 text-muted-foreground">
					Coach opens interactive canvas sims so you can manipulate the model, not just read about
					it.
				</p>
			</div>
		</article>

		<article class="{cardClass} min-h-72 {twAnimateInViewSubtle} lg:col-span-5">
			<div class="{wellClass} min-h-52 p-4 sm:p-5" aria-hidden="true">
				<div
					class="pointer-events-none overflow-hidden rounded-2xl border border-border bg-card py-4 text-sm shadow-none ring-1 ring-foreground/10"
				>
					<div class="space-y-0.5 px-4">
						<p class="text-sm leading-normal font-medium">Active weekly study plan</p>
						<p class="text-xs text-muted-foreground">Every task is capped at 30 minutes.</p>
					</div>
					<div class="mt-2 px-4">
						{#each planTasks as task (task.label)}
							<div
								class="flex min-w-0 items-center justify-between gap-2 border-b border-border py-2.5 last:border-b-0"
							>
								<div class="min-w-0 flex-1">
									<p class="truncate text-sm font-medium {task.done ? 'line-through' : ''}">
										{task.label}
									</p>
									<p class="text-[0.65rem] text-muted-foreground">{task.meta}</p>
								</div>
								<div class="flex shrink-0 gap-1.5">
									<span
										class="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs font-medium shadow-xs"
									>
										<BookOpenIcon class="size-3" />
										Practice
									</span>
									<span
										class="inline-flex h-7 items-center rounded-md bg-primary px-2 text-xs font-medium text-primary-foreground {task.done
											? 'opacity-50'
											: ''}"
									>
										Complete
									</span>
								</div>
							</div>
						{/each}
					</div>
				</div>
			</div>
			<div class={captionClass}>
				<h3 class="text-xl font-semibold tracking-tight">Finish this week</h3>
				<p class="mt-2 text-sm leading-6 text-muted-foreground">
					Get personalized study plans to fill the gaps.
				</p>
			</div>
		</article>
	</div>
</section>
