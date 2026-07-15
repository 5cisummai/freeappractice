<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Topbar from '$lib/components/layout/topbar.svelte';
	import SiteFooter from '$lib/components/layout/site-footer.svelte';
	import { Signature } from '$lib/components/spell/signature';
	import { TextAnimate } from '$lib/components/magic/text-animate';
	import { BlurFade } from '$lib/components/magic/blur-fade';
	import { HyperText } from '$lib/components/magic/hyper-text';
	import { MorphingText } from '$lib/components/magic/morphing-text';
	import { AuroraText } from '$lib/components/magic/aurora-text';
	import { SparklesText } from '$lib/components/magic/sparkles-text';
	import { AnimatedBeam } from '$lib/components/magic/animated-beam';
	import { AnimatedList } from '$lib/components/magic/animated-list';
	import { FlickeringGrid } from '$lib/components/magic/flickering-grid';
	import { LightRays } from '$lib/components/magic/light-rays';
	import { ScrollProgress } from '$lib/components/magic/scroll-progress';
	import { ShimmerButton } from '$lib/components/magic/shimmer-button';
	import { LineShadowText } from '$lib/components/magic/line-shadow-text';
	import { NumberTicker } from '$lib/components/magic/number-ticker';
	import { Meteors } from '$lib/components/magic/meteors';
	import { BorderBeam } from '$lib/components/magic/border-beam';
	import { DotPattern } from '$lib/components/magic/dot-pattern';
	import { ShineBorder } from '$lib/components/magic/shine-border';
	import { BlurReveal } from '$lib/components/spell/blur-reveal';
	import { WordsStagger } from '$lib/components/spell/words-stagger';
	import { GradientWaveText } from '$lib/components/spell/gradient-wave-text';
	import { TextMarquee } from '$lib/components/spell/text-marquee';
	import { ScrambleIn } from '$lib/components/fancy/scramble-in';
	import { VerticalCutReveal } from '$lib/components/fancy/vertical-cut-reveal';
	import { TextRotate } from '$lib/components/fancy/text-rotate';

	/** Intro choreography: 0 blank → 1 brand → 2 morph → 3 scroll open */
	let introPhase = $state(0);
	let reduceMotion = $state(false);

	const morphLines = [
		'FREE AP PRACTICE',
		'NO PAYWALL',
		'NO SETUP WALL',
		'JUST PRACTICE'
	];

	const rotateLines = [
		'one good question',
		'instant feedback',
		'zero friction',
		'real trust'
	];

	const frictionItems = [
		{ id: 'f1', label: 'Create an account first' },
		{ id: 'f2', label: 'Navigate the dashboard' },
		{ id: 'f3', label: 'Choose a plan' },
		{ id: 'f4', label: 'Hit a paywall' },
		{ id: 'f5', label: 'Still no question answered' }
	];

	const marqueeItems = [
		'accounts',
		'dashboards',
		'plans',
		'paywalls',
		'onboarding',
		'diagnostics',
		'funnels',
		'friction'
	];

	const principles = [
		{
			id: 'p1',
			title: 'Practice before setup',
			body: '[PLACEHOLDER] Students answer first. Accounts wait.'
		},
		{
			id: 'p2',
			title: 'Simplicity is engineered',
			body: '[PLACEHOLDER] Calm surface. Complex system underneath.'
		},
		{
			id: 'p3',
			title: 'AI removes scarcity',
			body: '[PLACEHOLDER] Not judgment. Quality still earns its place.'
		},
		{
			id: 'p4',
			title: 'Free means usable',
			body: '[PLACEHOLDER] Not a demo. Not a funnel. The real thing.'
		}
	] as const;

	const loopNodes = [
		{ id: 'subject', label: 'Subject' },
		{ id: 'question', label: 'Question' },
		{ id: 'feedback', label: 'Feedback' },
		{ id: 'continue', label: 'Continue' }
	] as const;

	let beamContainer: HTMLDivElement | null = $state(null);
	let subjectRef: HTMLElement | null = $state(null);
	let questionRef: HTMLElement | null = $state(null);
	let feedbackRef: HTMLElement | null = $state(null);
	let continueRef: HTMLElement | null = $state(null);

	onMount(() => {
		reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (reduceMotion) {
			introPhase = 3;
			return;
		}

		const t1 = setTimeout(() => (introPhase = 1), 350);
		const t2 = setTimeout(() => (introPhase = 2), 1800);
		const t3 = setTimeout(() => (introPhase = 3), 3600);
		return () => {
			clearTimeout(t1);
			clearTimeout(t2);
			clearTimeout(t3);
		};
	});

	function goPractice() {
		void goto(resolve('/subjects'));
	}
</script>

<svelte:head>
	<title>Why – Free AP Practice</title>
	<meta
		name="description"
		content="A cinematic look at why Free AP Practice exists — removing friction so AP practice starts in two clicks."
	/>
	<link rel="canonical" href="https://freeappractice.org/why" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://freeappractice.org/why" />
	<meta property="og:title" content="Why – Free AP Practice" />
	<meta
		property="og:description"
		content="A cinematic look at why Free AP Practice exists — removing friction so AP practice starts in two clicks."
	/>
	<meta property="og:image" content="https://freeappractice.org/icon.png" />
	<meta property="og:site_name" content="FreeAPPractice.org" />
	<meta property="og:locale" content="en_US" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:url" content="https://freeappractice.org/why" />
	<meta name="twitter:title" content="Why – Free AP Practice" />
	<meta
		name="twitter:description"
		content="A cinematic look at why Free AP Practice exists — removing friction so AP practice starts in two clicks."
	/>
	<meta name="twitter:image" content="https://freeappractice.org/icon.png" />
</svelte:head>

<div class="dark relative min-h-screen overflow-x-clip bg-background text-foreground">
	<ScrollProgress
		class="from-sky-400 via-blue-500 to-indigo-400 bg-linear-to-r"
	/>

	<Topbar />

	<main id="main-content">
		<!-- ═══════════════════════════════════════════
		     ACT I — Brand intro
		     ═══════════════════════════════════════════ -->
		<section
			class="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-5"
			aria-label="Introduction"
		>
			<div class="pointer-events-none absolute inset-0" aria-hidden="true">
				<FlickeringGrid
					class="absolute inset-0 size-full opacity-60"
					squareSize={3}
					gridGap={5}
					flickerChance={0.22}
					color="rgb(96, 165, 250)"
					maxOpacity={0.28}
				/>
				<LightRays
					class="absolute inset-0 opacity-70"
					color="rgba(96, 165, 250, 0.18)"
					count={8}
					blur={40}
					speed={16}
					length="85vh"
				/>
				<div
					class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,var(--background)_75%)]"
				></div>
			</div>

			<div class="relative z-10 flex w-full max-w-5xl flex-col items-center gap-8 text-center">
				{#if introPhase >= 1}
					<div class="w-full">
						{#if reduceMotion}
							<h1
								class="font-display text-4xl font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl"
							>
								FREE AP PRACTICE
							</h1>
						{:else}
							<HyperText
								text="FREE AP PRACTICE"
								as="h1"
								duration={1400}
								animateOnHover={false}
								class="font-display text-4xl font-semibold tracking-tight sm:text-6xl lg:text-7xl"
							/>
						{/if}
					</div>
				{/if}

				{#if introPhase >= 2}
					<div class="w-full max-w-3xl">
						{#if reduceMotion}
							<p class="font-display text-2xl text-muted-foreground sm:text-4xl">
								JUST PRACTICE
							</p>
						{:else}
							<MorphingText
								texts={morphLines}
								class="h-14 text-[1.75rem] text-foreground sm:h-20 sm:text-[3.25rem] lg:text-[4rem]"
							/>
						{/if}
					</div>

					<div class="max-w-xl">
						<BlurReveal
							as="p"
							triggerOnView={false}
							delay={0.2}
							class="text-base leading-7 text-muted-foreground sm:text-lg"
						>
							[PLACEHOLDER] The story of stripping AP prep down to its essential loop.
						</BlurReveal>
					</div>
				{/if}

				{#if introPhase >= 3}
					<BlurFade delay={0.15} direction="up" class="mt-4">
						<p
							class="animate-pulse text-xs tracking-[0.28em] text-muted-foreground uppercase"
						>
							Scroll to enter
						</p>
					</BlurFade>
				{/if}
			</div>
		</section>

		{#if introPhase >= 3 || reduceMotion}
			<!-- ═══════════════════════════════════════════
			     ACT II — Friction (show the problem)
			     ═══════════════════════════════════════════ -->
			<section
				class="relative flex min-h-svh flex-col justify-center gap-12 overflow-hidden px-5 py-24"
				aria-label="The friction"
			>
				<div class="pointer-events-none absolute inset-0 opacity-40" aria-hidden="true">
					<Meteors number={18} />
				</div>

				<div class="relative z-10 mx-auto w-full max-w-3xl">
					<BlurFade direction="up">
						<p class="mb-3 text-xs tracking-[0.25em] text-sky-400/80 uppercase">
							The problem
						</p>
					</BlurFade>

					<WordsStagger
						as="h2"
						triggerOnView
						class="font-display text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl"
					>
						[PLACEHOLDER] The path from “I need practice” to a real question is too long.
					</WordsStagger>
				</div>

				<div class="relative z-10 mx-auto grid w-full max-w-5xl gap-10 lg:grid-cols-2 lg:items-center">
					<div class="rounded-2xl border border-white/10 bg-card/40 p-4 backdrop-blur-sm">
						<AnimatedList items={frictionItems} delay={900} class="w-full">
							{#snippet children(item)}
								<div
									class="rounded-xl border border-white/10 bg-background/80 px-4 py-3 text-left shadow-sm"
								>
									<p class="text-sm font-medium text-foreground">{item.label}</p>
									<p class="text-xs text-muted-foreground">
										[PLACEHOLDER] Another step before practice.
									</p>
								</div>
							{/snippet}
						</AnimatedList>
					</div>

					<div class="flex flex-col gap-6">
						<div
							class="relative overflow-hidden rounded-2xl border border-white/10 bg-card/30 p-6"
						>
							<TextMarquee
								items={marqueeItems}
								speed={0.85}
								height={220}
								itemHeight={44}
								class="w-full"
							>
								{#snippet children(item)}
									<span
										class="font-display text-2xl tracking-tight text-muted-foreground/80"
									>
										{item}
									</span>
								{/snippet}
							</TextMarquee>
						</div>

						<BlurFade delay={0.2} direction="up">
							<p class="text-base leading-7 text-muted-foreground sm:text-lg">
								[PLACEHOLDER] Many tools are useful. The ceremony around them is not.
							</p>
						</BlurFade>
					</div>
				</div>
			</section>

			<!-- ═══════════════════════════════════════════
			     ACT III — Thesis (cinematic sticky)
			     ═══════════════════════════════════════════ -->
			<section
				class="thesis-track relative h-[180vh]"
				aria-label="Central idea"
			>
				<div
					class="sticky top-0 flex min-h-svh items-center justify-center overflow-hidden px-5"
				>
					<div class="pointer-events-none absolute inset-0" aria-hidden="true">
						<DotPattern
							class="absolute inset-0 opacity-30 mask-[radial-gradient(ellipse_at_center,white,transparent_70%)]"
							width={18}
							height={18}
							cr={1.1}
						/>
					</div>

					<div class="relative z-10 mx-auto max-w-4xl text-center">
						{#if reduceMotion}
							<blockquote
								class="font-display text-3xl leading-[1.15] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl"
							>
								Practicing for an AP exam should be as easy as opening a page and answering a
								question.
							</blockquote>
						{:else}
							<div class="thesis-line">
								<VerticalCutReveal
									splitBy="words"
									staggerDuration={0.08}
									autoStart={true}
									containerClass="justify-center"
									class="font-display text-3xl leading-[1.15] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl"
								>
									Practicing for an AP exam should be as easy as opening a page and answering a
									question.
								</VerticalCutReveal>
							</div>
						{/if}
					</div>
				</div>
			</section>

			<!-- ═══════════════════════════════════════════
			     ACT IV — The loop (show the product)
			     ═══════════════════════════════════════════ -->
			<section
				class="relative flex min-h-svh flex-col justify-center gap-14 px-5 py-24"
				aria-label="The essential loop"
			>
				<div class="mx-auto w-full max-w-3xl text-center">
					<BlurFade>
						<p class="mb-3 text-xs tracking-[0.25em] text-sky-400/80 uppercase">The loop</p>
					</BlurFade>
					<TextAnimate
						content="choose → answer → understand → continue"
						animation="blurInUp"
						by="character"
						once
						class="font-display text-2xl font-semibold tracking-tight sm:text-4xl"
					/>
					<div class="mt-6 flex flex-wrap items-center justify-center gap-2 text-lg text-muted-foreground sm:text-xl">
						<span>[PLACEHOLDER] Built for</span>
						<TextRotate
							texts={rotateLines}
							rotationInterval={2200}
							mainClassName="font-display text-foreground"
							class="inline-flex min-w-[10ch] justify-center"
						/>
					</div>
				</div>

				<div
					bind:this={beamContainer}
					class="relative mx-auto flex w-full max-w-4xl flex-col items-stretch gap-8 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
				>
					<div bind:this={subjectRef} class="relative z-10 flex flex-1 flex-col items-center gap-2">
						<div
							class="relative flex size-20 items-center justify-center rounded-2xl border border-white/15 bg-card/60 shadow-lg backdrop-blur-md sm:size-24"
						>
							<ShineBorder
								class="rounded-2xl"
								shineColor={['#38bdf8', '#60a5fa', '#818cf8']}
								duration={10}
							/>
							<span class="font-mono text-xs tracking-wider text-sky-300">01</span>
						</div>
						<p class="font-display text-sm font-medium tracking-tight sm:text-base">
							{loopNodes[0].label}
						</p>
					</div>

					<div bind:this={questionRef} class="relative z-10 flex flex-1 flex-col items-center gap-2">
						<div
							class="relative flex size-20 items-center justify-center rounded-2xl border border-white/15 bg-card/60 shadow-lg backdrop-blur-md sm:size-24"
						>
							<ShineBorder
								class="rounded-2xl"
								shineColor={['#38bdf8', '#60a5fa', '#818cf8']}
								duration={10}
							/>
							<span class="font-mono text-xs tracking-wider text-sky-300">02</span>
						</div>
						<p class="font-display text-sm font-medium tracking-tight sm:text-base">
							{loopNodes[1].label}
						</p>
					</div>

					<div bind:this={feedbackRef} class="relative z-10 flex flex-1 flex-col items-center gap-2">
						<div
							class="relative flex size-20 items-center justify-center rounded-2xl border border-white/15 bg-card/60 shadow-lg backdrop-blur-md sm:size-24"
						>
							<ShineBorder
								class="rounded-2xl"
								shineColor={['#38bdf8', '#60a5fa', '#818cf8']}
								duration={10}
							/>
							<span class="font-mono text-xs tracking-wider text-sky-300">03</span>
						</div>
						<p class="font-display text-sm font-medium tracking-tight sm:text-base">
							{loopNodes[2].label}
						</p>
					</div>

					<div bind:this={continueRef} class="relative z-10 flex flex-1 flex-col items-center gap-2">
						<div
							class="relative flex size-20 items-center justify-center rounded-2xl border border-white/15 bg-card/60 shadow-lg backdrop-blur-md sm:size-24"
						>
							<ShineBorder
								class="rounded-2xl"
								shineColor={['#38bdf8', '#60a5fa', '#818cf8']}
								duration={10}
							/>
							<span class="font-mono text-xs tracking-wider text-sky-300">04</span>
						</div>
						<p class="font-display text-sm font-medium tracking-tight sm:text-base">
							{loopNodes[3].label}
						</p>
					</div>

					{#if beamContainer && subjectRef && questionRef}
						<AnimatedBeam
							containerRef={beamContainer}
							fromRef={subjectRef}
							toRef={questionRef}
							curvature={-40}
							gradientStartColor="#38bdf8"
							gradientStopColor="#60a5fa"
							pathColor="rgba(148,163,184,0.35)"
							class="hidden sm:block"
						/>
					{/if}
					{#if beamContainer && questionRef && feedbackRef}
						<AnimatedBeam
							containerRef={beamContainer}
							fromRef={questionRef}
							toRef={feedbackRef}
							curvature={40}
							gradientStartColor="#60a5fa"
							gradientStopColor="#818cf8"
							pathColor="rgba(148,163,184,0.35)"
							delay={0.3}
							class="hidden sm:block"
						/>
					{/if}
					{#if beamContainer && feedbackRef && continueRef}
						<AnimatedBeam
							containerRef={beamContainer}
							fromRef={feedbackRef}
							toRef={continueRef}
							curvature={-40}
							gradientStartColor="#818cf8"
							gradientStopColor="#a78bfa"
							pathColor="rgba(148,163,184,0.35)"
							delay={0.6}
							class="hidden sm:block"
						/>
					{/if}
				</div>

				<BlurFade delay={0.15} class="mx-auto max-w-xl text-center">
					<p class="text-base leading-7 text-muted-foreground">
						[PLACEHOLDER] That loop is the product. Everything else is secondary — including
						keeping it free.
					</p>
				</BlurFade>
			</section>

			<!-- ═══════════════════════════════════════════
			     ACT V — Principles
			     ═══════════════════════════════════════════ -->
			<section class="relative px-5 py-28" aria-label="Product philosophy">
				<div class="mx-auto mb-16 max-w-3xl text-center">
					<BlurFade>
						<p class="mb-3 text-xs tracking-[0.25em] text-sky-400/80 uppercase">
							Philosophy
						</p>
					</BlurFade>
					<LineShadowText
						content="Principles that shape what ships"
						as="h2"
						shadowColor="#38bdf8"
						class="font-display text-3xl font-semibold tracking-tight sm:text-5xl"
					/>
				</div>

				<div class="mx-auto grid max-w-5xl gap-5 sm:grid-cols-2">
					{#each principles as principle, i (principle.id)}
						<BlurFade delay={0.1 * i} direction="up">
							<div
								class="relative overflow-hidden rounded-2xl border border-white/10 bg-card/40 p-6 backdrop-blur-sm"
							>
								<BorderBeam
									size={80}
									duration={8}
									delay={i * 1.2}
									colorFrom="#38bdf8"
									colorTo="#818cf8"
									borderWidth={1.5}
								/>
								<p class="mb-3 font-mono text-xs text-sky-400/70">
									{String(i + 1).padStart(2, '0')}
								</p>
								<h3 class="mb-3 font-display text-xl font-semibold tracking-tight sm:text-2xl">
									{#if reduceMotion}
										{principle.title}
									{:else}
										<ScrambleIn
											text={principle.title}
											scrambleSpeed={40}
											scrambledLetterCount={3}
											class="inline"
										/>
									{/if}
								</h3>
								<p class="text-sm leading-7 text-muted-foreground sm:text-base">
									{principle.body}
								</p>
							</div>
						</BlurFade>
					{/each}
				</div>
			</section>

			<!-- ═══════════════════════════════════════════
			     ACT VI — System pulse
			     ═══════════════════════════════════════════ -->
			<section
				class="relative overflow-hidden px-5 py-28"
				aria-label="How the system works"
			>
				<div class="pointer-events-none absolute inset-0 opacity-50" aria-hidden="true">
					<FlickeringGrid
						class="absolute inset-0 size-full"
						squareSize={2}
						gridGap={8}
						color="rgb(129, 140, 248)"
						maxOpacity={0.18}
					/>
				</div>

				<div class="relative z-10 mx-auto max-w-4xl">
					<div class="mb-14 text-center">
						<BlurFade>
							<p class="mb-3 text-xs tracking-[0.25em] text-sky-400/80 uppercase">
								Under the surface
							</p>
						</BlurFade>
						<GradientWaveText
							class="font-display text-3xl font-semibold tracking-tight sm:text-5xl"
						>
							[PLACEHOLDER] Quiet interface. Serious machinery.
						</GradientWaveText>
					</div>

					<div class="mb-14 grid grid-cols-2 gap-6 sm:grid-cols-4">
						<div class="text-center">
							<p class="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
								<NumberTicker value={2} />
							</p>
							<p class="mt-2 text-xs tracking-wide text-muted-foreground uppercase">
								Clicks to practice
							</p>
						</div>
						<div class="text-center">
							<p class="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
								<NumberTicker value={0} />
							</p>
							<p class="mt-2 text-xs tracking-wide text-muted-foreground uppercase">
								Required signup
							</p>
						</div>
						<div class="text-center">
							<p class="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
								$<NumberTicker value={0} />
							</p>
							<p class="mt-2 text-xs tracking-wide text-muted-foreground uppercase">
								To start
							</p>
						</div>
						<div class="text-center">
							<p class="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
								<NumberTicker value={1} />
							</p>
							<p class="mt-2 text-xs tracking-wide text-muted-foreground uppercase">
								Essential loop
							</p>
						</div>
					</div>

					<BlurFade delay={0.1}>
						<ul class="mx-auto flex max-w-2xl flex-col gap-3 text-sm text-muted-foreground sm:text-base">
							<li class="rounded-xl border border-white/10 bg-card/30 px-4 py-3">
								[PLACEHOLDER] Questions generated for specific AP subjects and units.
							</li>
							<li class="rounded-xl border border-white/10 bg-card/30 px-4 py-3">
								[PLACEHOLDER] Strong questions cached and reused — quality over regen spam.
							</li>
							<li class="rounded-xl border border-white/10 bg-card/30 px-4 py-3">
								[PLACEHOLDER] Instant answers + explanations. Accounts optional.
							</li>
							<li class="rounded-xl border border-white/10 bg-card/30 px-4 py-3">
								[PLACEHOLDER] Feedback loops improve weak questions over time.
							</li>
						</ul>
					</BlurFade>
				</div>
			</section>

			<!-- ═══════════════════════════════════════════
			     ACT VII — Close
			     ═══════════════════════════════════════════ -->
			<section
				class="relative flex min-h-[80vh] flex-col items-center justify-center gap-12 overflow-hidden px-5 py-28 text-center"
				aria-label="Closing"
			>
				<div class="pointer-events-none absolute inset-0" aria-hidden="true">
					<LightRays
						class="absolute inset-0 opacity-60"
						color="rgba(56, 189, 248, 0.16)"
						count={6}
						length="90vh"
					/>
				</div>

				<div class="relative z-10 mx-auto max-w-3xl">
					<SparklesText
						as="h2"
						sparklesCount={14}
						colors={{ first: '#38bdf8', second: '#a5b4fc' }}
						class="font-display text-3xl leading-[1.2] font-semibold tracking-tight text-balance sm:text-5xl"
					>
						[PLACEHOLDER] Not effortless studying — just nothing in the way of starting.
					</SparklesText>

					<div class="mt-8">
						<AuroraText
							class="font-display text-lg sm:text-2xl"
							colors={['#38bdf8', '#60a5fa', '#818cf8', '#c4b5fd']}
						>
							Free AP Practice
						</AuroraText>
					</div>
				</div>

				<div
					class="relative z-10 flex flex-col items-center gap-10 sm:flex-row sm:items-end sm:justify-center"
				>
					<ShimmerButton
						onclick={goPractice}
						background="oklch(0.55 0.2 250)"
						shimmerColor="#e0f2fe"
						class="px-8 py-3.5 text-base font-medium"
					>
						Start practicing
					</ShimmerButton>
					<Signature text="Ajay Saravanan" color="currentColor" class="text-foreground" />
				</div>
			</section>
		{/if}
	</main>

	<SiteFooter />
</div>

<style>
	.thesis-track {
		view-timeline-name: --why-thesis;
		view-timeline-axis: block;
	}

	.thesis-line {
		opacity: 0.35;
		transform: scale(0.96);
		animation: thesis-settle linear both;
		animation-timeline: --why-thesis;
		animation-range: entry 10% cover 70%;
	}

	@keyframes thesis-settle {
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.thesis-line {
			animation: none;
			opacity: 1;
			transform: none;
		}
	}
</style>
