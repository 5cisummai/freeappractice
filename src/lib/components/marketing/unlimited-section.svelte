<script lang="ts">
	import { performanceBarClass, performanceTextClass } from '$lib/components/app/performance.js';
	import TutorWidget from '$lib/components/questions/tutor-widget.svelte';
	import SectionIntro from '$lib/components/marketing/section-intro.svelte';
	import { twAnimateInViewSubtle } from '$lib/tw-animate';
	import { DEMO_TUTOR_QUESTION } from '$lib/tutor/demo-question';
	import ArrowRightIcon from '@tabler/icons-svelte/icons/arrow-right';
	import TargetIcon from '@tabler/icons-svelte/icons/target';
	import TrendingUpIcon from '@tabler/icons-svelte/icons/trending-up';

	let { showTutor = true }: { showTutor?: boolean } = $props();

	const questionChoices = [
		{ letter: 'A', text: 'Krebs cycle', correct: false },
		{ letter: 'B', text: 'Light reactions', correct: true },
		{ letter: 'C', text: 'Glycolysis', correct: false },
		{ letter: 'D', text: 'Calvin cycle', correct: false }
	];

	type NextQuestion = {
		n: number;
		prompt: string;
		choices?: string[];
		current?: boolean;
	};

	const nextQuestions: NextQuestion[] = [
		{ n: 13, prompt: 'Where is ATP synthase located in the chloroplast?' },
		{
			n: 14,
			prompt: 'What is the primary electron donor in photosynthesis?',
			choices: ['NADPH', 'Water', 'CO₂', 'G3P'],
			current: true
		}
	];

	const masteryUnits = [
		{ name: 'Unit 1: Chemistry of Life', mastery: 82, attempts: 24 },
		{ name: 'Unit 3: Cellular Energetics', mastery: 38, attempts: 18 },
		{ name: 'Unit 4: Cell Communication', mastery: 71, attempts: 12 }
	];

	const cardClass = `rounded-3xl border border-border bg-muted/50 p-6 ${twAnimateInViewSubtle}`;
	const largeCardClass = cardClass;
	const masteryCardClass = cardClass;
	const titleClass = 'text-xl font-semibold tracking-tight';
	const descClass = 'mt-2 text-sm leading-6 text-muted-foreground';
	const mockCardClass = 'rounded-2xl border border-border bg-background';
	const fadeWellClass = 'relative min-h-44 flex-1 overflow-hidden -mb-6';
</script>

<section id="unlimited" class="w-full space-y-10" aria-labelledby="unlimited-section-heading">
	<SectionIntro id="unlimited-section-heading">
		{#snippet title()}
			Truly free AP practice
		{/snippet}
		{#snippet description()}
			<p>Questions, explanations, a tutor, and unit mastery map without those annoying limits.</p>
		{/snippet}
	</SectionIntro>

	<div class="grid gap-5 lg:grid-cols-5 lg:gap-6">
		<article class="{cardClass} flex flex-col lg:col-span-2">
			<div class="relative min-h-44 flex-1 overflow-hidden" aria-hidden="true">
				<div class="{mockCardClass} p-4">
					<p class="text-sm font-semibold">Question 1</p>
					<p class="mt-2 font-serif text-sm leading-6 text-foreground/90">
						Which process occurs in the thylakoid membrane during photosynthesis?
					</p>
					<div class="mt-3 space-y-1.5">
						{#each questionChoices as choice (choice.letter)}
							<div
								class="rounded-lg border px-3 py-2 {choice.correct
									? 'border-emerald-500/70 bg-emerald-500/10'
									: 'border-border/60 opacity-70'}"
							>
								<div class="flex gap-2.5">
									<span
										class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[0.65rem] font-semibold {choice.correct
											? 'border-emerald-500 bg-emerald-500 text-white'
											: 'border-border bg-muted/40 text-muted-foreground'}"
									>
										{choice.letter}
									</span>
									<span class="font-serif text-xs leading-5">{choice.text}</span>
								</div>
							</div>
						{/each}
					</div>
					<div class="mt-3 space-y-1 border-t border-border pt-3">
						<p class="text-xs font-medium text-emerald-700 dark:text-emerald-400">Correct</p>
						<p class="font-serif text-xs leading-5 text-foreground/85">
							Light reactions happen in the thylakoid membrane, where chlorophyll absorbs photons
							and splits water.
						</p>
					</div>
				</div>
			</div>
			<div class="mt-4">
				<h3 class={titleClass}>Instant feedback</h3>
				<p class={descClass}>Answer, result, and get an explanation immediately.</p>
			</div>
		</article>

		<article
			class="{largeCardClass} flex flex-col overflow-hidden lg:col-span-3 lg:flex-row lg:items-stretch lg:gap-8"
		>
			<div class={fadeWellClass} aria-hidden="true">
				<div class="space-y-2.5">
					<div class="flex items-center justify-between px-0.5">
						<p class="text-xs text-muted-foreground">AP Biology · Unit 3</p>
						<p class="text-xs font-medium text-muted-foreground tabular-nums">14 answered</p>
					</div>
					{#each nextQuestions as card (card.n)}
						<div class="{mockCardClass} p-3.5 {card.current ? '' : 'opacity-80'}">
							<div class="flex items-start justify-between gap-3">
								<p class="text-xs font-medium text-muted-foreground">Question {card.n}</p>
								{#if card.current}
									<span
										class="rounded-full bg-primary/10 px-2 py-0.5 text-[0.65rem] font-medium text-primary"
									>
										Up next
									</span>
								{/if}
							</div>
							<p class="mt-1 font-serif text-sm leading-6 text-foreground/90">{card.prompt}</p>
							{#if card.choices}
								<div class="mt-2.5 grid grid-cols-2 gap-1.5">
									{#each card.choices as choice, index (choice)}
										<div
											class="rounded-lg border border-border px-2.5 py-1.5 font-serif text-xs leading-5 {card.current &&
											index === 1
												? 'border-primary/40 bg-primary/5'
												: 'opacity-70'}"
										>
											<span class="mr-1.5 font-semibold">{String.fromCharCode(65 + index)}</span>
											{choice}
										</div>
									{/each}
								</div>
							{/if}
							{#if card.current}
								<span
									class="mt-3 inline-flex h-8 items-center rounded-md border border-border bg-background px-2.5 text-xs font-medium"
								>
									Next Question
								</span>
							{/if}
						</div>
					{/each}
				</div>
			</div>
			<div class="mt-4 lg:mt-0 lg:w-56 lg:shrink-0 lg:self-center">
				<h3 class={titleClass}>Unlimited questions</h3>
				<p class={descClass}>Keep on practicing until you make it stick</p>
			</div>
		</article>

		<article
			class="{masteryCardClass} flex flex-col overflow-hidden {showTutor
				? 'lg:col-span-3'
				: 'lg:col-span-5'} lg:flex-row lg:items-stretch lg:gap-8"
		>
			<div class="{fadeWellClass} space-y-3" aria-hidden="true">
				<div class="{mockCardClass} p-4">
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

				<div class="{mockCardClass} p-4">
					<div class="flex items-center justify-between gap-3">
						<div class="flex min-w-0 items-start gap-3">
							<div class="mt-0.5 rounded-lg bg-rose-500/10 p-2 text-rose-600 dark:text-rose-400">
								<TrendingUpIcon class="size-4" />
							</div>
							<div class="min-w-0">
								<p class="text-xs text-muted-foreground">Recommended next</p>
								<p class="truncate text-sm font-semibold">Unit 3: Cellular Energetics</p>
								<p class="mt-0.5 text-xs text-muted-foreground">38% mastery · 3 recent mistakes</p>
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

				<div class="{mockCardClass} overflow-hidden">
					{#each masteryUnits as unit (unit.name)}
						<div class="border-b border-border last:border-b-0">
							<div class="flex items-center gap-3 px-4 py-3">
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
						</div>
					{/each}
				</div>
			</div>
			<div class="mt-4 lg:mt-0 lg:w-56 lg:shrink-0 lg:self-center">
				<h3 class={titleClass}>Unit mastery</h3>
				<p class={descClass}>
					Analyze your weaknesses and strengths to improve your scores efficiently
				</p>
			</div>
		</article>

		{#if showTutor}
			<article
				class="{cardClass} flex h-80 min-h-0 flex-col overflow-hidden lg:col-span-2 lg:h-0 lg:min-h-full"
			>
				<div class="relative min-h-0 flex-1 overflow-hidden">
					<TutorWidget
						embedded
						questionId={DEMO_TUTOR_QUESTION.id}
						apClass={DEMO_TUTOR_QUESTION.apClass}
						unit={DEMO_TUTOR_QUESTION.unit}
					/>
				</div>
				<div class="mt-4">
					<h3 class={titleClass}>AI Tutor</h3>
					<p class={descClass}>Get personalized assistance built for learning first</p>
				</div>
			</article>
		{/if}
	</div>
</section>
