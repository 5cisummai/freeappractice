<script lang="ts">
	import { performanceBarClass, performanceTextClass } from '$lib/components/app/performance.js';
	import TutorWidget from '$lib/components/questions/tutor-widget.svelte';
	import SectionIntro from '$lib/components/marketing/section-intro.svelte';
	import { twAnimateInViewSubtle } from '$lib/tw-animate';
	import { DEMO_TUTOR_QUESTION } from '$lib/tutor/demo-question';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import TargetIcon from '@lucide/svelte/icons/target';
	import TrendingUpIcon from '@lucide/svelte/icons/trending-up';

	const questionChoices = [
		{ letter: 'A', text: 'Krebs cycle', correct: false },
		{ letter: 'B', text: 'Light reactions', correct: true },
		{ letter: 'C', text: 'Glycolysis', correct: false },
		{ letter: 'D', text: 'Calvin cycle', correct: false }
	];

	const nextQuestions = [
		{
			n: 12,
			prompt: 'Which enzyme regenerates RuBP in the Calvin cycle?',
			offset: 'top-2 left-8 rotate-2 opacity-40'
		},
		{
			n: 13,
			prompt: 'Where is ATP synthase located in the chloroplast?',
			offset: 'top-8 left-4 -rotate-1 opacity-70'
		},
		{
			n: 14,
			prompt: 'What is the primary electron donor in photosynthesis?',
			offset: 'top-14 left-6'
		}
	];

	const masteryUnits = [
		{ name: 'Unit 1: Chemistry of Life', mastery: 82, attempts: 24, expanded: false },
		{
			name: 'Unit 3: Cellular Energetics',
			mastery: 38,
			attempts: 18,
			expanded: true,
			weak: ['Light-dependent reactions', 'Calvin cycle'],
			strong: ['ATP / ADP']
		},
		{ name: 'Unit 4: Cell Communication', mastery: 71, attempts: 12, expanded: false }
	];

	const wellClass = 'relative flex min-h-0 flex-1 overflow-hidden bg-background/25 dark:bg-background/10';
	const cardChrome =
		'flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-border/70 marketing-card-shadow';
	const captionClass = 'space-y-2 border-t border-border/70 px-6 py-6 sm:px-8 sm:py-7';
</script>

<section id="unlimited" class="w-full space-y-12" aria-labelledby="unlimited-section-heading">
	<SectionIntro id="unlimited-section-heading">
		{#snippet title()}
			Unlimited practice
		{/snippet}
		{#snippet description()}
			<p>Questions, explanations, a tutor, and a unit mastery map—none of it meters out.</p>
		{/snippet}
	</SectionIntro>

	<div
		class="grid min-h-[52svh] items-stretch gap-6 sm:grid-cols-2 lg:min-h-[58svh] lg:grid-cols-3 lg:gap-8"
	>
		<div
			class="grid gap-6 lg:col-span-2 lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-8"
		>
			<article
				class="{cardChrome} min-h-72 bg-emerald-100 dark:bg-emerald-950/50 {twAnimateInViewSubtle}"
			>
				<div class="{wellClass} min-h-52" aria-hidden="true">
					<div
						class="pointer-events-none absolute top-6 -right-8 left-5 overflow-hidden rounded-xl border border-border/70 bg-card/95 shadow-sm ring-1 ring-foreground/10"
					>
						<div class="space-y-3 p-4">
							<p class="text-sm font-semibold">Question 1</p>
							<p class="text-sm leading-6 text-foreground/90">
								Which process occurs in the thylakoid membrane during photosynthesis?
							</p>
							<div class="space-y-1.5">
								{#each questionChoices as choice (choice.letter)}
									<div
										class="rounded-lg border px-3 py-2 {choice.correct
											? 'border-emerald-500/70 bg-emerald-500/10'
											: 'border-border/60 bg-background/60 opacity-70'}"
									>
										<div class="flex gap-2.5">
											<span
												class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[0.65rem] font-semibold {choice.correct
													? 'border-emerald-500 bg-emerald-500 text-white'
													: 'border-border bg-muted/40 text-muted-foreground'}"
											>
												{choice.letter}
											</span>
											<span class="text-xs leading-5">{choice.text}</span>
										</div>
									</div>
								{/each}
							</div>
						</div>
						<div class="space-y-1.5 border-t border-border/70 px-4 py-3">
							<p class="text-xs font-medium text-emerald-700 dark:text-emerald-400">Correct</p>
							<p class="text-xs leading-5 text-foreground/85">
								Light reactions happen in the thylakoid membrane, where chlorophyll absorbs photons
								and splits water.
							</p>
						</div>
					</div>
				</div>
				<div class={captionClass}>
					<h3 class="text-base font-semibold tracking-tight">Instant feedback</h3>
					<p class="text-sm leading-6 text-muted-foreground">
						Answer, result, and why—immediately.
					</p>
				</div>
			</article>

			<article class="{cardChrome} min-h-72 bg-sky-100 dark:bg-sky-950/50 {twAnimateInViewSubtle}">
				<div class="{wellClass} min-h-52" aria-hidden="true">
					<div class="pointer-events-none absolute inset-0">
						{#each nextQuestions as card (card.n)}
							<div
								class="absolute right-2 w-[88%] rounded-xl border border-border/70 bg-card p-4 shadow-sm {card.offset}"
							>
								<p class="text-xs font-medium text-muted-foreground">Question {card.n}</p>
								<p class="mt-1 text-sm leading-6 text-foreground/90">{card.prompt}</p>
								{#if card.n === 14}
									<span
										class="mt-3 inline-flex h-8 items-center rounded-md border border-border bg-background px-2.5 text-xs font-medium shadow-xs"
									>
										Next Question
									</span>
								{/if}
							</div>
						{/each}
					</div>
				</div>
				<div class={captionClass}>
					<h3 class="text-base font-semibold tracking-tight">Unlimited questions</h3>
					<p class="text-sm leading-6 text-muted-foreground">As many as you need. No cap.</p>
				</div>
			</article>

			<article
				class="{cardChrome} min-h-80 bg-violet-100 lg:col-span-2 dark:bg-violet-950/50 {twAnimateInViewSubtle}"
			>
				<div class="{wellClass} min-h-64" aria-hidden="true">
					<div class="pointer-events-none absolute top-4 -right-6 left-4 space-y-3 sm:left-5">
						<div class="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
							<div class="flex items-center gap-3">
								<div
									class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-muted {performanceTextClass(
										62
									)}"
								>
									<TargetIcon class="size-5" />
								</div>
								<div class="min-w-0 flex-1">
									<p class="text-xs text-muted-foreground">AP Biology · Overall mastery</p>
									<p class="text-sm font-semibold">Developing · 62%</p>
								</div>
								<div class="hidden shrink-0 text-right sm:block">
									<p class="text-xs text-muted-foreground">Questions</p>
									<p class="text-sm font-semibold tabular-nums">47</p>
								</div>
							</div>
						</div>

						<div class="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
							<div class="flex items-center justify-between gap-3">
								<div class="flex min-w-0 items-start gap-3">
									<div
										class="mt-0.5 rounded-lg bg-rose-500/10 p-2 text-rose-600 dark:text-rose-400"
									>
										<TrendingUpIcon class="size-4" />
									</div>
									<div class="min-w-0">
										<p class="text-xs text-muted-foreground">Recommended next</p>
										<p class="truncate text-sm font-semibold">Unit 3: Cellular Energetics</p>
										<p class="mt-0.5 text-xs text-muted-foreground">
											38% mastery · 3 recent mistakes
										</p>
									</div>
								</div>
								<span
									class="inline-flex h-8 shrink-0 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground"
								>
									Practice
									<ArrowRightIcon class="size-3.5" />
								</span>
							</div>
						</div>

						<div class="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
							{#each masteryUnits as unit (unit.name)}
								<div class="border-b border-border/70 last:border-b-0">
									<div class="flex items-center gap-3 px-4 py-3">
										<ChevronDownIcon
											class="size-4 shrink-0 text-muted-foreground {unit.expanded
												? 'rotate-180'
												: ''}"
										/>
										<div class="min-w-0 flex-1">
											<p class="truncate text-sm font-medium">{unit.name}</p>
											<div class="mt-1.5 flex items-center gap-3">
												<div class="h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-muted">
													<div
														class="h-full rounded-full {performanceBarClass(unit.mastery)}"
														style:width="{unit.mastery}%"
													></div>
												</div>
												<span
													class="w-10 text-right text-sm font-semibold tabular-nums {performanceTextClass(
														unit.mastery
													)}"
												>
													{unit.mastery}%
												</span>
											</div>
										</div>
										<p class="hidden shrink-0 text-xs text-muted-foreground sm:block">
											{unit.attempts} attempts
										</p>
									</div>
									{#if unit.expanded && unit.weak && unit.strong}
										<div
											class="grid gap-4 border-t border-border/60 bg-muted/20 px-4 py-3 sm:grid-cols-2 sm:px-11"
										>
											<div class="space-y-1">
												<p
													class="text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase"
												>
													Weak topics
												</p>
												{#each unit.weak as topic (topic)}
													<p class="text-xs text-foreground/90">{topic}</p>
												{/each}
											</div>
											<div class="space-y-1">
												<p
													class="text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase"
												>
													Strong topics
												</p>
												{#each unit.strong as topic (topic)}
													<p class="text-xs text-foreground/90">{topic}</p>
												{/each}
											</div>
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				</div>
				<div class={captionClass}>
					<h3 class="text-base font-semibold tracking-tight">Unit mastery</h3>
					<p class="text-sm leading-6 text-muted-foreground">
						Weak topics and what to practice next—not just a score.
					</p>
				</div>
			</article>
		</div>

		<article
			class="{cardChrome} min-h-[52svh] bg-amber-50 lg:min-h-0 dark:bg-amber-950/40 {twAnimateInViewSubtle}"
		>
			<div class="{wellClass} min-h-104">
				<div class="absolute inset-x-4 top-4 bottom-0 min-h-0">
					<TutorWidget
						embedded
						questionId={DEMO_TUTOR_QUESTION.id}
						apClass={DEMO_TUTOR_QUESTION.apClass}
						unit={DEMO_TUTOR_QUESTION.unit}
					/>
				</div>
			</div>
			<div class={captionClass}>
				<h3 class="text-base font-semibold tracking-tight">AI tutor</h3>
				<p class="text-sm leading-6 text-muted-foreground">Ask why until it clicks.</p>
			</div>
		</article>
	</div>
</section>
