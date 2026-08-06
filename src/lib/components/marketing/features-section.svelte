<script lang="ts">
	import { resolve } from '$app/paths';
	import { twAnimateInView, twAnimateInViewSubtle } from '$lib/tw-animate';
	import { Button } from '$lib/components/ui/button/index.js';
	import { onboardingSubjects } from '$lib/onboarding-subjects';
	import RocketIcon from '@lucide/svelte/icons/rocket';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import SendHorizontalIcon from '@lucide/svelte/icons/send-horizontal';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import FlameIcon from '@lucide/svelte/icons/flame';
	import LeafIcon from '@lucide/svelte/icons/leaf';
	import CalculatorIcon from '@lucide/svelte/icons/calculator';
	import FlaskConicalIcon from '@lucide/svelte/icons/flask-conical';
	import XIcon from '@lucide/svelte/icons/x';

	const featuredSubjects = onboardingSubjects.filter((s) => !s.name.includes('Lunch')).slice(0, 6);

	const dashboardSubjects = [
		{
			name: 'AP Biology',
			percent: 47,
			last: 'Today',
			iconClass: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400',
			Icon: LeafIcon,
			barClass: 'bg-emerald-500'
		},
		{
			name: 'AP Calculus AB',
			percent: 62,
			last: 'Yesterday',
			iconClass: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/80 dark:text-indigo-400',
			Icon: CalculatorIcon,
			barClass: 'bg-indigo-500'
		},
		{
			name: 'AP Chemistry',
			percent: 28,
			last: '5 days ago',
			iconClass: 'bg-violet-100 text-violet-600 dark:bg-violet-950/80 dark:text-violet-400',
			Icon: FlaskConicalIcon,
			barClass: 'bg-violet-500'
		}
	];

	const progressStats = [
		{
			label: 'Questions answered',
			value: '47',
			labelClass: 'text-sky-700 dark:text-sky-300',
			valueClass: 'text-sky-950 dark:text-sky-50'
		},
		{
			label: 'Accuracy',
			value: '82%',
			labelClass: 'text-emerald-700 dark:text-emerald-300',
			valueClass: 'text-emerald-950 dark:text-emerald-50'
		},
		{
			label: 'Current streak',
			value: '5 days',
			labelClass: 'text-amber-700 dark:text-amber-300',
			valueClass: 'text-amber-950 dark:text-amber-50'
		},
		{
			label: 'Study time',
			value: '3.2h',
			labelClass: 'text-violet-700 dark:text-violet-300',
			valueClass: 'text-violet-950 dark:text-violet-50'
		}
	];

	const feedbackChoices = [
		{ letter: 'A', text: 'Krebs cycle', state: 'idle' as const },
		{ letter: 'B', text: 'Light reactions', state: 'correct' as const },
		{ letter: 'C', text: 'Glycolysis', state: 'idle' as const },
		{ letter: 'D', text: 'Calvin cycle', state: 'idle' as const }
	];

	const coachSuggestions = [
		'What should I study next?',
		'Build me a plan for this week',
		'Help me focus on my weakest unit'
	];

	const personalizedTutorMessages = [
		{ role: 'user' as const, text: 'I keep missing Unit 3 questions.' },
		{
			role: 'assistant' as const,
			text: "You've missed 4 of your last 6 on cellular energetics. Let's walk through light reactions step by step."
		}
	];

	const cardClass =
		'flex flex-col overflow-hidden rounded-[1.25rem] border border-border/70 bg-card shadow-sm transition-shadow duration-300 hover:shadow-md';
</script>

<section
	class="relative mx-auto w-full max-w-6xl space-y-10"
	aria-labelledby="features-section-heading"
>
	<div class="mx-auto max-w-3xl space-y-5 text-center {twAnimateInView}">
		<h2
			id="features-section-heading"
			class="font-display text-3xl leading-tight font-medium tracking-tight text-balance sm:text-4xl"
		>
			Built from scratch for <span
				class="underline decoration-primary/70 decoration-2 underline-offset-4">seamless</span
			> AP practice
		</h2>
		<p class="mx-auto max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
			Using technology to make exam prep simpler, smarter, and more rewarding for every student.
		</p>
		<div class="flex flex-wrap items-center justify-center gap-3 pt-1">
			<Button href={resolve('/signup')} size="lg" class="rounded-full px-6">
				<RocketIcon class="size-4" />
				Get Started
			</Button>
			<Button href={resolve('/subjects')} variant="outline" size="lg" class="rounded-full px-6">
				Browse Subjects
			</Button>
		</div>
	</div>

	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:grid-rows-[auto_auto]">
		<!-- Top left: Subjects with real subject icon chips -->
		<article class="{cardClass} {twAnimateInViewSubtle}">
			<div
				class="relative flex min-h-48 flex-1 items-center justify-center px-5 py-7"
				aria-label="20+ AP subjects including Biology, Calculus, Chemistry, and more"
			>
				<div class="flex max-w-64 flex-wrap justify-center gap-2">
					{#each featuredSubjects as subject (subject.name)}
						{@const SubjectIcon = subject.icon}
						<span
							class="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background px-2.5 py-1 text-[0.65rem] font-medium shadow-sm"
						>
							<span class="flex size-5 items-center justify-center rounded-md {subject.iconClass}">
								<SubjectIcon class="size-3" />
							</span>
							{subject.name.replace(/^AP /, '')}
						</span>
					{/each}
				</div>
			</div>
			<div class="space-y-1.5 px-6 pb-6">
				<h3 class="text-base font-semibold tracking-tight">20+ Subjects Covered</h3>
				<p class="text-sm leading-6 text-muted-foreground">
					Practice across sciences, math, history, English, and more—all in one place.
				</p>
			</div>
		</article>

		<!-- Center tall: Real dashboard + progress stats -->
		<article class="{cardClass} sm:col-span-2 lg:col-span-1 lg:row-span-2 {twAnimateInViewSubtle}">
			<div class="flex flex-1 flex-col gap-3 px-4 pt-5 sm:px-5" aria-hidden="true">
				<!-- Dashboard recommendation callout -->
				<div class="rounded-2xl border border-primary/25 bg-primary/5 p-3.5">
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0 flex-1 space-y-2.5">
							<div class="space-y-0.5">
								<p class="font-display text-base font-medium tracking-tight">AP Biology</p>
								<p class="text-[0.7rem] text-muted-foreground">Continue where you left off</p>
							</div>
							<div class="space-y-1.5">
								<p class="text-[0.65rem] text-muted-foreground">
									47% complete · 47 / 100 questions
								</p>
								<div class="h-1.5 w-full overflow-hidden rounded-full bg-muted">
									<div class="h-full w-[47%] rounded-full bg-primary"></div>
								</div>
							</div>
							<div
								class="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-2.5 text-[0.65rem] font-medium text-primary-foreground"
							>
								Continue practicing
								<ArrowRightIcon class="size-3" />
							</div>
						</div>
						<div
							class="flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-background"
						>
							<LeafIcon class="size-4 text-primary" />
						</div>
					</div>
				</div>

				<!-- Progress colored stats (2x2) -->
				<div class="grid grid-cols-2 gap-2">
					{#each progressStats as stat (stat.label)}
						<div class="rounded-xl border border-border/60 bg-background p-2.5 shadow-sm">
							<p class="text-[0.58rem] font-medium {stat.labelClass}">{stat.label}</p>
							<p class="mt-0.5 text-sm font-semibold tabular-nums {stat.valueClass}">
								{stat.value}
							</p>
						</div>
					{/each}
				</div>

				<!-- Subject list rows -->
				<div class="overflow-hidden rounded-2xl border border-border/60 bg-background shadow-sm">
					<div class="flex items-center justify-between border-b border-border/70 px-3 py-2">
						<p class="text-[0.7rem] font-semibold">Your subjects</p>
						<span
							class="inline-flex items-center gap-1 text-[0.65rem] font-semibold text-orange-500"
						>
							<FlameIcon class="size-3" />
							5
						</span>
					</div>
					<div class="divide-y divide-border/70">
						{#each dashboardSubjects as subject (subject.name)}
							{@const SubjectIcon = subject.Icon}
							<div class="flex items-center gap-2.5 px-3 py-2.5">
								<div
									class="flex size-8 shrink-0 items-center justify-center rounded-lg {subject.iconClass}"
								>
									<SubjectIcon class="size-3.5" />
								</div>
								<div class="min-w-0 flex-1 space-y-1">
									<div class="flex items-center justify-between gap-2">
										<p class="truncate text-[0.7rem] font-medium">{subject.name}</p>
										<span class="text-[0.6rem] text-muted-foreground tabular-nums"
											>{subject.percent}%</span
										>
									</div>
									<div class="h-1.5 w-full overflow-hidden rounded-full bg-muted">
										<div
											class="h-full rounded-full {subject.barClass}"
											style:width="{subject.percent}%"
										></div>
									</div>
									<p class="text-[0.55rem] text-muted-foreground">Last practiced {subject.last}</p>
								</div>
								<ChevronRightIcon class="size-3.5 shrink-0 text-muted-foreground" />
							</div>
						{/each}
					</div>
				</div>
			</div>
			<div class="space-y-1.5 px-6 pt-4 pb-6">
				<h3 class="text-base font-semibold tracking-tight">Question History &amp; Insights</h3>
				<p class="text-sm leading-6 text-muted-foreground">
					Create a free account to track every attempt, review past questions, and see where to
					focus next.
				</p>
			</div>
		</article>

		<!-- Top right: Super Coach -->
		<article class="{cardClass} {twAnimateInViewSubtle}">
			<div class="flex min-h-48 flex-1 items-center justify-center px-4 py-6" aria-hidden="true">
				<div class="flex w-full max-w-60 flex-col gap-3">
					<p
						class="px-1 text-center font-display text-lg leading-tight font-medium tracking-tight text-balance"
					>
						Ask me any study questions
					</p>
					<div class="flex flex-wrap justify-center gap-1.5">
						{#each coachSuggestions as suggestion (suggestion)}
							<span
								class="rounded-full border border-border/70 bg-background px-2.5 py-1 text-[0.58rem] font-medium text-foreground shadow-sm"
							>
								{suggestion}
							</span>
						{/each}
					</div>
					<div class="rounded-[22px] border border-border/80 bg-muted/40 px-3 py-2 shadow-sm">
						<div class="flex items-end gap-2">
							<span class="min-w-0 flex-1 px-1 py-1.5 text-[0.65rem] text-muted-foreground">
								Ask Coach anything…
							</span>
							<span
								class="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
							>
								<ArrowUpIcon class="size-3.5" />
							</span>
						</div>
					</div>
				</div>
			</div>
			<div class="space-y-1.5 px-6 pb-6">
				<div class="flex items-center gap-2">
					<h3 class="text-base font-semibold tracking-tight">AI Coach</h3>
					<span
						class="inline-flex items-center rounded-full border border-violet-300/50 bg-linear-to-r from-violet-500/10 via-fuchsia-500/10 to-cyan-400/10 px-2 py-0.5 text-[0.65rem] font-semibold text-violet-700 shadow-sm shadow-violet-500/10 dark:text-violet-300"
					>
						Super
					</span>
				</div>
				<p class="text-sm leading-6 text-muted-foreground">
					Get a personalized study plan from your practice data—what to study next and where to
					focus.
				</p>
			</div>
		</article>

		<!-- Bottom left: Real question card + MCQ feedback -->
		<article class="{cardClass} {twAnimateInViewSubtle}">
			<div class="flex min-h-44 flex-1 items-center justify-center px-4 py-5" aria-hidden="true">
				<div
					class="w-full max-w-64 overflow-hidden rounded-xl border border-border/70 bg-card/95 shadow-sm backdrop-blur-sm"
				>
					<div class="space-y-3 p-3.5">
						<p class="text-sm font-semibold">Question 1</p>
						<p class="text-[0.7rem] leading-5 text-foreground/90">
							Which process occurs in the thylakoid membrane during photosynthesis?
						</p>
						<div class="space-y-1.5">
							{#each feedbackChoices as choice (choice.letter)}
								<div
									class="w-full rounded-lg border px-2.5 py-2 text-left {choice.state === 'correct'
										? 'border-emerald-500/70 bg-emerald-500/10'
										: 'border-border/60 bg-background/60 opacity-80'}"
								>
									<div class="flex gap-2">
										<span
											class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[0.55rem] font-semibold {choice.state ===
											'correct'
												? 'border-emerald-500 bg-emerald-500 text-white'
												: 'border-border bg-muted/40 text-muted-foreground'}"
										>
											{choice.letter}
										</span>
										<span class="text-[0.65rem] leading-5">{choice.text}</span>
									</div>
								</div>
							{/each}
						</div>
					</div>
					<div class="flex items-center justify-between border-t border-border/70 px-3.5 py-2">
						<p class="text-[0.65rem] text-muted-foreground">Correct! Nice work.</p>
						<span
							class="rounded-md border border-border bg-background px-2 py-1 text-[0.6rem] font-medium"
						>
							Next Question
						</span>
					</div>
				</div>
			</div>
			<div class="space-y-1.5 px-6 pb-6">
				<h3 class="text-base font-semibold tracking-tight">Instant Feedback</h3>
				<p class="text-sm leading-6 text-muted-foreground">
					Know right away if you got it right, with a clear explanation the moment you submit.
				</p>
			</div>
		</article>

		<!-- Bottom right: Personalized Tutor -->
		<article class="{cardClass} {twAnimateInViewSubtle}">
			<div class="flex min-h-44 flex-1 items-center justify-center px-4 py-5" aria-hidden="true">
				<div
					class="w-full max-w-56 overflow-hidden rounded-2xl border border-border bg-card shadow-lg"
				>
					<div class="flex items-center justify-between px-3 py-2.5">
						<div class="flex min-w-0 items-center gap-1.5">
							<span
								class="shrink-0 rounded-full border border-violet-300/50 bg-linear-to-r from-violet-500/10 via-fuchsia-500/10 to-cyan-400/10 px-1.5 py-0.5 text-[0.55rem] font-medium shadow-sm shadow-violet-500/10"
							>
								Personalized
							</span>
							<SparklesIcon class="size-3.5 shrink-0" />
							<span class="truncate text-[0.7rem] font-semibold">AI Tutor</span>
						</div>
						<span class="rounded-md p-0.5 text-muted-foreground">
							<XIcon class="size-3" />
						</span>
					</div>
					<div class="flex flex-col gap-2.5 px-3 pb-2">
						{#each personalizedTutorMessages as message, index (index)}
							<div class={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
								{#if message.role === 'user'}
									<div
										class="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-2.5 py-1.5 text-[0.6rem] leading-snug text-primary-foreground"
									>
										{message.text}
									</div>
								{:else}
									<p class="max-w-[90%] text-[0.6rem] leading-snug text-foreground/90">
										{message.text}
									</p>
								{/if}
							</div>
						{/each}
					</div>
					<div class="px-3 pb-3">
						<div
							class="flex items-center gap-1.5 rounded-3xl border border-border bg-background px-2.5 py-1.5 shadow-sm"
						>
							<span class="flex-1 text-[0.6rem] text-muted-foreground">Ask a question…</span>
							<span class="rounded-lg p-1 text-primary">
								<SendHorizontalIcon class="size-3" />
							</span>
						</div>
					</div>
				</div>
			</div>
			<div class="space-y-1.5 px-6 pb-6">
				<div class="flex items-center gap-2">
					<h3 class="text-base font-semibold tracking-tight">Personalized Tutor</h3>
					<span
						class="inline-flex items-center rounded-full border border-violet-300/50 bg-linear-to-r from-violet-500/10 via-fuchsia-500/10 to-cyan-400/10 px-2 py-0.5 text-[0.65rem] font-semibold text-violet-700 shadow-sm shadow-violet-500/10 dark:text-violet-300"
					>
						Super
					</span>
				</div>
				<p class="text-sm leading-6 text-muted-foreground">
					A tutor that knows your weak spots and walks you through questions using your real
					practice history.
				</p>
			</div>
		</article>
	</div>
</section>
