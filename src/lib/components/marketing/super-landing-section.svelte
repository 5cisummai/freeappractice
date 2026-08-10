<script lang="ts">
	import { twAnimateInView, twAnimateInViewSubtle } from '$lib/tw-animate';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days';
	import PenLineIcon from '@lucide/svelte/icons/pen-line';
	import CheckIcon from '@lucide/svelte/icons/check';
	import BrainIcon from '@lucide/svelte/icons/brain';
	import LineChartIcon from '@lucide/svelte/icons/line-chart';
	import MessageCircleIcon from '@lucide/svelte/icons/message-circle';

	let { freeBeta = false }: { freeBeta?: boolean } = $props();

	const coachSuggestions = [
		'What should I study next?',
		'Build me a plan for this week',
		'Help me focus on my weakest unit'
	];

	const studyPlanTasks = [
		{ subject: 'AP Biology', task: 'Review Unit 3 light reactions', minutes: 20, done: true },
		{ subject: 'AP Calculus AB', task: 'Chain rule practice set', minutes: 25, done: false },
		{ subject: 'AP Chemistry', task: 'Stoichiometry FRQ draft', minutes: 30, done: false }
	];

	const superIncludes = $derived([
		'Personalized MCQ and FRQ tutoring',
		'AI Coach with weekly study plans',
		'Actionable insights from your history',
		freeBeta
			? '300 personalized messages per month during beta'
			: '600 personalized messages per month'
	]);

	const cardClass =
		'overflow-hidden rounded-[1.5rem] border border-border/70 bg-card shadow-sm transition-all duration-300 hover:border-violet-300/40 hover:shadow-lg hover:shadow-violet-500/10';
</script>

<div class="space-y-24 lg:space-y-32">
	<section aria-labelledby="super-features-heading" class="mx-auto max-w-6xl space-y-10">
		<div class="mx-auto max-w-2xl space-y-4 text-center {twAnimateInView}">
			<h2
				id="super-features-heading"
				class="font-display text-3xl font-medium tracking-tight text-balance sm:text-4xl"
			>
				Built around you
			</h2>
			<p class="text-base leading-7 text-muted-foreground">
				Tutor, Coach, insights, and weekly plans—personalized from your practice.
			</p>
		</div>

		<div class="grid gap-4 lg:grid-cols-12 lg:grid-rows-[auto_auto]">
			<article class="{cardClass} lg:col-span-7 {twAnimateInViewSubtle}">
				<div class="flex min-h-56 items-center justify-center p-6" aria-hidden="true">
					<div class="w-full max-w-md space-y-4">
						<div class="flex flex-wrap justify-center gap-2">
							{#each coachSuggestions as suggestion (suggestion)}
								<span
									class="rounded-full border border-violet-300/30 bg-background px-3 py-1.5 text-xs font-medium shadow-sm"
								>
									{suggestion}
								</span>
							{/each}
						</div>
						<div
							class="rounded-[1.5rem] border border-border/80 bg-muted/30 px-4 py-3 shadow-inner"
						>
							<div class="flex items-end gap-3">
								<span class="flex-1 px-1 py-2 text-sm text-muted-foreground">
									Ask Coach anything…
								</span>
								<span
									class="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md"
								>
									<ArrowUpIcon class="size-4" />
								</span>
							</div>
						</div>
					</div>
				</div>
				<div class="space-y-2 border-t border-border/70 px-6 py-5">
					<div class="flex items-center gap-2">
						<BrainIcon class="size-4 text-violet-500" aria-hidden="true" />
						<h3 class="text-lg font-semibold tracking-tight">AI Coach</h3>
					</div>
					<p class="text-sm leading-6 text-muted-foreground">
						Study plans you approve, updated from your practice.
					</p>
				</div>
			</article>

			<article class="{cardClass} lg:col-span-5 {twAnimateInViewSubtle}">
				<div class="flex min-h-56 items-center justify-center p-6" aria-hidden="true">
					<div
						class="w-full max-w-xs space-y-3 rounded-2xl border border-border/70 bg-background p-4 shadow-md"
					>
						<div class="flex items-center gap-2 border-b border-border/70 pb-3">
							<FileTextIcon class="size-4 text-violet-500" />
							<p class="text-sm font-semibold">Insights brief</p>
						</div>
						<p class="text-xs leading-5 text-muted-foreground">
							Strongest: Unit 2 cell structure. Focus next: Unit 3 energetics and FRQ evidence
							phrasing.
						</p>
						<div class="grid grid-cols-2 gap-2">
							<div class="rounded-xl bg-emerald-500/10 px-3 py-2 text-center">
								<p class="text-[0.65rem] text-muted-foreground">MCQ accuracy</p>
								<p class="text-lg font-semibold text-emerald-700 dark:text-emerald-300">82%</p>
							</div>
							<div class="rounded-xl bg-violet-500/10 px-3 py-2 text-center">
								<p class="text-[0.65rem] text-muted-foreground">Units to review</p>
								<p class="text-lg font-semibold text-violet-700 dark:text-violet-300">2</p>
							</div>
						</div>
					</div>
				</div>
				<div class="space-y-2 border-t border-border/70 px-6 py-5">
					<div class="flex items-center gap-2">
						<LineChartIcon class="size-4 text-violet-500" aria-hidden="true" />
						<h3 class="text-lg font-semibold tracking-tight">Actionable Insights</h3>
					</div>
					<p class="text-sm leading-6 text-muted-foreground">
						See what's working, what's not, and what to do next.
					</p>
				</div>
			</article>

			<article class="{cardClass} lg:col-span-5 {twAnimateInViewSubtle}">
				<div class="flex min-h-48 items-center justify-center p-6" aria-hidden="true">
					<div
						class="w-full max-w-xs overflow-hidden rounded-2xl border border-border/70 bg-background shadow-md"
					>
						<div
							class="flex items-center gap-2 border-b border-border/70 super-tier-gradient px-4 py-2.5"
						>
							<CalendarDaysIcon class="size-4 text-violet-500" />
							<p class="text-sm font-semibold">This week's plan</p>
						</div>
						<div class="divide-y divide-border/70">
							{#each studyPlanTasks as item (item.task)}
								<div class="flex items-start gap-3 px-4 py-3">
									<span
										class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border {item.done
											? 'border-emerald-500 bg-emerald-500 text-white'
											: 'border-border'}"
									>
										{#if item.done}
											<CheckIcon class="size-2.5" />
										{/if}
									</span>
									<div class="min-w-0 space-y-0.5">
										<p class="text-xs font-medium">{item.task}</p>
										<p class="text-[0.65rem] text-muted-foreground">
											{item.subject} · {item.minutes} min
										</p>
									</div>
								</div>
							{/each}
						</div>
					</div>
				</div>
				<div class="space-y-2 border-t border-border/70 px-6 py-5">
					<h3 class="text-lg font-semibold tracking-tight">Weekly Study Plans</h3>
					<p class="text-sm leading-6 text-muted-foreground">
						30-minute tasks you can actually finish.
					</p>
				</div>
			</article>

			<article class="{cardClass} lg:col-span-7 {twAnimateInViewSubtle}">
				<div class="flex min-h-48 items-center justify-center gap-3 p-6" aria-hidden="true">
					<div
						class="w-full max-w-44 rounded-xl border border-border/70 bg-background p-4 shadow-sm"
					>
						<MessageCircleIcon class="size-5 text-violet-500" />
						<p class="mt-2 text-sm font-semibold">Multiple choice</p>
						<p class="mt-1 text-xs leading-5 text-muted-foreground">
							Progressive hints and explanations tied to your misses.
						</p>
					</div>
					<ArrowRightIcon class="size-5 shrink-0 text-muted-foreground" />
					<div
						class="w-full max-w-44 rounded-xl border border-violet-300/40 super-tier-gradient p-4 shadow-sm"
					>
						<PenLineIcon class="size-5 text-violet-600 dark:text-violet-300" />
						<p class="mt-2 text-sm font-semibold">Written response</p>
						<p class="mt-1 text-xs leading-5 text-muted-foreground">
							Rubric-aware feedback on FRQ drafts and revisions.
						</p>
					</div>
				</div>
				<div class="space-y-2 border-t border-border/70 px-6 py-5">
					<h3 class="text-lg font-semibold tracking-tight">MCQ and FRQ tutoring</h3>
					<p class="text-sm leading-6 text-muted-foreground">
						Help on multiple choice and free response, where you practice.
					</p>
				</div>
			</article>
		</div>
	</section>

	<section
		aria-labelledby="super-includes-heading"
		class="mx-auto max-w-4xl rounded-3xl border border-border/70 bg-card p-8 shadow-sm sm:p-10 {twAnimateInView}"
	>
		<div class="grid gap-8 md:grid-cols-2 md:items-center">
			<div class="space-y-3">
				<p
					class="text-sm font-semibold tracking-wide text-violet-600 uppercase dark:text-violet-300"
				>
					What's included
				</p>
				<h2
					id="super-includes-heading"
					class="font-display text-2xl font-medium tracking-tight sm:text-3xl"
				>
					All of this, built on your practice data
				</h2>
				<p class="text-sm leading-6 text-muted-foreground">
					Free practice stays free. Super adds personalization when you want it.
				</p>
			</div>
			<ul class="space-y-3">
				{#each superIncludes as item (item)}
					<li
						class="flex items-center gap-3 rounded-xl border border-border/60 bg-background px-4 py-3 text-sm"
					>
						<span
							class="flex size-6 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-300"
						>
							<CheckIcon class="size-3.5" aria-hidden="true" />
						</span>
						{item}
					</li>
				{/each}
			</ul>
		</div>
	</section>
</div>
