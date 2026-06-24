<script lang="ts">
	import { resolve } from '$app/paths';
	import { twAnimateInView, twAnimateInViewSubtle } from '$lib/tw-animate';
	import { Button } from '$lib/components/ui/button/index.js';
	import { getCourses } from '$lib/catalog/ap-classes';
	import RocketIcon from '@lucide/svelte/icons/rocket';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import CheckCircle2Icon from '@lucide/svelte/icons/check-circle-2';
	import SendHorizontalIcon from '@lucide/svelte/icons/send-horizontal';

	const shortSubjectNames: Record<string, string> = {
		'AP Physics C: Mechanics': 'Physics C',
		'AP Physics C: E&M': 'Physics C E&M',
		'AP Computer Science A': 'CS A',
		'AP Computer Science Principles': 'CS Principles',
		'AP English Language': 'English Lang',
		'AP English Literature': 'English Lit',
		'AP US History': 'US History',
		'AP World History': 'World History',
		'AP European History': 'Euro History',
		'AP US Government': 'US Gov',
		'AP Comparative Government': 'Comp Gov',
		'AP Human Geography': 'Human Geo',
		'AP Macroeconomics': 'Macro',
		'AP Microeconomics': 'Micro',
		'AP Environmental Science': 'Env Science',
		'AP Spanish Language': 'Spanish'
	};

	const subjectNames = getCourses()
		.filter((course) => !course.name.includes('Lunch'))
		.map((course) => shortSubjectNames[course.name] ?? course.name.replace(/^AP /, ''));

	const visibleSubjects = subjectNames
		.slice(0, Math.ceil(subjectNames.length / 2))
		.map((name, index, subjects) => ({
			name,
			fade: subjects.length > 1 ? index / (subjects.length - 1) : 0
		}));

	const subjectPillStyles = [
		'bg-foreground text-background',
		'border border-border/70 bg-background text-foreground',
		'bg-sky-100 text-sky-900 dark:bg-sky-900/60 dark:text-sky-100',
		'bg-violet-100 text-violet-900 dark:bg-violet-900/60 dark:text-violet-100',
		'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100',
		'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-100'
	];

	const effortlessSteps = [
		{ label: 'Pick a subject', detail: 'AP Biology' },
		{ label: 'Generate', detail: 'One click' },
		{ label: 'Practice', detail: 'Start now' }
	];

	const feedbackChoices = [
		{ letter: 'A', text: 'Krebs cycle', selected: false },
		{ letter: 'B', text: 'Light reactions', selected: true, correct: true },
		{ letter: 'C', text: 'Glycolysis', selected: false }
	];

	const tutorMessages = [
		{ role: 'user', text: 'Why is B the right answer?' },
		{
			role: 'assistant',
			text: 'Light reactions happen in the thylakoid and produce ATP + NADPH for the Calvin cycle.'
		}
	] as const;
</script>

<section
	class="relative mx-auto w-full max-w-6xl space-y-10"
	aria-labelledby="features-section-heading"
>
	<div
		class="pointer-events-none absolute inset-x-0 top-1/2 -z-10 h-[70%] -translate-y-1/2 rounded-[3rem] bg-gradient-to-br from-sky-200/40 via-violet-200/30 to-rose-200/30 blur-3xl dark:from-sky-900/20 dark:via-violet-900/15 dark:to-rose-900/15"
		aria-hidden="true"
	></div>

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
			<Button href="/signup" size="lg" class="rounded-full px-6">
				<RocketIcon class="size-4" />
				Get Started
			</Button>
			<Button href={resolve('/about')} variant="outline" size="lg" class="rounded-full px-6">
				Learn More
			</Button>
		</div>
	</div>

	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		<!-- Card 1: Subject coverage -->
		<article
			class="flex flex-col overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm transition-shadow duration-300 hover:shadow-md {twAnimateInViewSubtle}"
		>
			<div
				class="relative flex min-h-44 items-center justify-center overflow-hidden bg-muted/50 px-4 py-6 sm:px-5"
			>
				<div
					class="flex max-w-68 flex-wrap justify-center gap-1.5 mask-[linear-gradient(to_bottom,black_50%,transparent)]"
					aria-label="20+ AP subjects including {subjectNames.slice(0, 6).join(', ')}, and more"
				>
					{#each visibleSubjects as { name, fade }, index (name)}
						<span
							class="rounded-full px-2 py-0.5 text-[0.62rem] leading-tight font-medium sm:text-[0.65rem] {subjectPillStyles[
								index % subjectPillStyles.length
							]}"
							style:opacity={String(1 - fade * 0.75)}
							style:transform={`rotate(${(index % 5) * 2 - 4}deg)`}
						>
							{name}
						</span>
					{/each}
				</div>
			</div>
			<div class="space-y-2 px-6 py-5 text-center">
				<h3 class="text-base font-semibold">20+ Subjects Covered</h3>
				<p class="text-sm leading-6 text-muted-foreground">
					Built to deliver smooth performance and a flawless study experience.
				</p>
			</div>
		</article>

		<!-- Card 2: Effortless to use -->
		<article
			class="flex flex-col overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm transition-shadow duration-300 hover:shadow-md {twAnimateInViewSubtle}"
		>
			<div class="flex min-h-44 items-center justify-center bg-muted/50 px-4 py-6 sm:px-6">
				<div class="w-full max-w-62 space-y-3" aria-hidden="true">
					<div class="flex items-center justify-center gap-1.5">
						{#each effortlessSteps as step, index (step.label)}
							{#if index > 0}
								<ChevronRightIcon class="size-3.5 shrink-0 text-muted-foreground/70" />
							{/if}
							<div class="min-w-0 flex-1 text-center">
								<div
									class="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background"
								>
									{index + 1}
								</div>
								<p class="mt-1.5 truncate text-[0.62rem] font-medium">{step.label}</p>
								<p class="truncate text-[0.58rem] text-muted-foreground">{step.detail}</p>
							</div>
						{/each}
					</div>
					<div class="rounded-xl border border-border/70 bg-background p-2.5 shadow-sm">
						<div
							class="mb-2 flex items-center justify-between rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1.5 text-[0.65rem] font-medium"
						>
							<span>AP Biology</span>
							<span class="text-muted-foreground">▾</span>
						</div>
						<div
							class="rounded-lg bg-foreground px-2.5 py-1.5 text-center text-[0.65rem] font-medium text-background"
						>
							Generate Question
						</div>
					</div>
				</div>
			</div>
			<div class="space-y-2 px-6 py-5 text-center">
				<h3 class="text-base font-semibold">Effortless to Use</h3>
				<p class="text-sm leading-6 text-muted-foreground">
					Pick a subject, tap generate, and start practicing—no signup, no setup, no friction.
				</p>
			</div>
		</article>

		<!-- Card 3: Instant feedback -->
		<article
			class="flex flex-col overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm transition-shadow duration-300 hover:shadow-md sm:col-span-2 lg:col-span-1 {twAnimateInViewSubtle}"
		>
			<div
				class="relative flex min-h-44 items-center justify-center overflow-hidden bg-muted/50 px-4 py-6 sm:px-6"
			>
				<div
					class="w-full max-w-62 rounded-xl border border-border/70 bg-background p-3 shadow-sm"
					aria-hidden="true"
				>
					<p class="mb-2.5 text-[0.65rem] leading-snug font-medium text-foreground">
						Which process occurs in the thylakoid membrane?
					</p>
					<div class="space-y-1.5">
						{#each feedbackChoices as choice (choice.letter)}
							<div
								class="flex items-center gap-2 rounded-lg border px-2 py-1.5 text-[0.62rem] {choice.selected
									? 'border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/30'
									: 'border-border/60 bg-muted/20'}"
							>
								<span
									class="flex size-4 shrink-0 items-center justify-center rounded-full border text-[0.55rem] font-semibold {choice.selected
										? 'border-emerald-600 bg-emerald-600 text-white'
										: 'border-border text-muted-foreground'}"
								>
									{choice.letter}
								</span>
								<span class="truncate">{choice.text}</span>
								{#if choice.selected && choice.correct}
									<CheckCircle2Icon
										class="ml-auto size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
									/>
								{/if}
							</div>
						{/each}
					</div>
					<div
						class="mt-2.5 flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-50 px-2 py-1.5 dark:bg-emerald-950/30"
					>
						<CheckCircle2Icon class="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
						<p class="text-[0.62rem] font-medium text-emerald-800 dark:text-emerald-200">
							Correct! Instant feedback.
						</p>
					</div>
				</div>
			</div>
			<div class="space-y-2 px-6 py-5 text-center">
				<h3 class="text-base font-semibold">Instant Feedback</h3>
				<p class="text-sm leading-6 text-muted-foreground">
					Know right away if you got it right, with a clear explanation the moment you submit.
				</p>
			</div>
		</article>

		<!-- Card 4: History & insights -->
		<article
			class="flex flex-col overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm transition-shadow duration-300 hover:shadow-md lg:col-span-2 {twAnimateInViewSubtle}"
		>
			<div class="flex min-h-52 items-center justify-center bg-muted/50 px-4 py-6 sm:px-8">
				<div
					class="w-full max-w-md rounded-2xl border border-border/70 bg-background p-4 shadow-md"
				>
					<div class="mb-3 flex items-center justify-between gap-2">
						<p class="truncate text-sm font-semibold">Your Progress</p>
						<span
							class="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[0.65rem] font-medium text-primary"
						>
							Signed in
						</span>
					</div>
					<div class="mb-3 grid grid-cols-3 gap-2">
						<div class="rounded-lg border border-border/60 px-2 py-2 text-center">
							<p class="text-sm font-semibold">47</p>
							<p class="text-[0.6rem] text-muted-foreground">Questions</p>
						</div>
						<div class="rounded-lg border border-border/60 px-2 py-2 text-center">
							<p class="text-sm font-semibold">82%</p>
							<p class="text-[0.6rem] text-muted-foreground">Accuracy</p>
						</div>
						<div class="rounded-lg border border-border/60 px-2 py-2 text-center">
							<p class="text-sm font-semibold">5</p>
							<p class="text-[0.6rem] text-muted-foreground">Day streak</p>
						</div>
					</div>
					<div class="space-y-1.5">
						{#each [{ subject: 'AP Biology · Unit 3', result: 'Correct' }, { subject: 'AP Calc AB · Unit 2', result: 'Review' }] as entry (entry.subject)}
							<div
								class="flex items-center justify-between rounded-lg border border-border/60 px-2.5 py-1.5 text-xs"
							>
								<span class="truncate text-muted-foreground">{entry.subject}</span>
								<span
									class="shrink-0 font-medium {entry.result === 'Correct'
										? 'text-emerald-600 dark:text-emerald-400'
										: 'text-amber-600 dark:text-amber-400'}"
								>
									{entry.result}
								</span>
							</div>
						{/each}
					</div>
				</div>
			</div>
			<div class="space-y-2 px-6 py-5 text-center">
				<h3 class="text-base font-semibold">Sign Up for Question History &amp; Insights</h3>
				<p class="text-sm leading-6 text-muted-foreground">
					Create a free account to track every attempt, review past questions, and see where to
					focus next.
				</p>
			</div>
		</article>

		<!-- Card 5: AI tutor -->
		<article
			class="flex flex-col overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm transition-shadow duration-300 hover:shadow-md {twAnimateInViewSubtle}"
		>
			<div class="relative flex min-h-52 items-center justify-center bg-muted/50 px-4 py-6 sm:px-6">
				<div
					class="w-full max-w-62 overflow-hidden rounded-2xl border border-border/70 bg-background shadow-md"
					aria-hidden="true"
				>
					<div class="flex items-center gap-2 bg-primary px-3 py-2">
						<SparklesIcon class="size-3.5 text-primary-foreground" />
						<span class="text-[0.7rem] font-semibold text-primary-foreground">AI Tutor</span>
					</div>
					<div class="space-y-2.5 p-3">
						{#each tutorMessages as message, index (index)}
							{#if message.role === 'user'}
								<div class="flex justify-end">
									<div
										class="max-w-[88%] rounded-2xl rounded-br-sm bg-primary px-2.5 py-1.5 text-[0.62rem] leading-snug text-primary-foreground"
									>
										{message.text}
									</div>
								</div>
							{:else}
								<div class="max-w-[92%] text-[0.62rem] leading-snug text-foreground/90">
									{message.text}
								</div>
							{/if}
						{/each}
					</div>
					<div class="border-t border-border px-3 py-2">
						<div
							class="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-2.5 py-1.5"
						>
							<span class="flex-1 text-[0.62rem] text-muted-foreground">Ask a question…</span>
							<SendHorizontalIcon class="size-3.5 text-primary" />
						</div>
					</div>
				</div>
			</div>
			<div class="space-y-2 px-6 py-5 text-center">
				<h3 class="text-base font-semibold">AI Tutor</h3>
				<p class="text-sm leading-6 text-muted-foreground">
					Stuck on a question? Chat with an AI tutor that knows the problem and walks you through
					it.
				</p>
			</div>
		</article>
	</div>
</section>
