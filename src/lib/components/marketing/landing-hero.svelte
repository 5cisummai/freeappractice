<script lang="ts">
	import type { Snippet } from 'svelte';
	import HalftoneBackground from '$lib/components/marketing/halftone-background.svelte';
	// import { Badge } from '$lib/components/ui/badge/index.js';
	// import { HERO_BADGE_LINK_CLASS } from '$lib/components/marketing/hero-badge.js';
	// import ChevronRightIcon from '@tabler/icons-svelte/icons/chevron-right';

	let { children }: { children?: Snippet } = $props();
</script>

<section
	id="hero"
	class="relative isolate z-0 -mt-14 flex min-h-svh flex-col items-center overflow-hidden bg-background px-5 pt-32 pb-20 sm:px-8 sm:pt-40 sm:pb-28 lg:px-10 lg:pt-44 lg:pb-32"
>
	<div class="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
		<HalftoneBackground />
	</div>
	<div
		class="pointer-events-none absolute inset-0 z-1 bg-linear-to-b from-background/65 via-background/25 to-background/15"
		aria-hidden="true"
	></div>

	<div class="relative z-10 flex w-full max-w-5xl flex-col items-center">
		<div class="flex max-w-3xl flex-col items-center space-y-6 text-center">
			<!-- <Badge href="/signup?group=1" variant="outline" class={HERO_BADGE_LINK_CLASS}>
				Create your study group
				<ChevronRightIcon class="size-4" />
			</Badge> -->
			<h1
				class="font-display text-[2.15rem] leading-[1.15] font-medium tracking-tight text-balance text-foreground sm:text-5xl lg:text-[3.5rem]"
			>
				Practice AP Exams
				<span class="relative inline-block px-1">
					Free.<svg
						class="pointer-events-none absolute -bottom-1 left-0 h-3 w-full text-primary"
						viewBox="0 0 88 10"
						fill="none"
						aria-hidden="true"
					>
						<path
							d="M2 7.4C20 3.8 37 2.1 50 4.2C63 6.3 74 6.9 86 5.8"
							stroke="currentColor"
							stroke-width="2.6"
							stroke-linecap="round"
						/>
					</svg>
				</span>
				Two Clicks. No Signup.
			</h1>

			<p
				class="max-w-xl text-base leading-7 text-balance text-muted-foreground sm:text-lg sm:leading-8"
			>
				Unlimited exam-style questions with personalized feedback across 20+ AP® subjects.
			</p>
		</div>

		{#if children}
			<div class="mt-16 w-full sm:mt-20">
				{@render children()}
			</div>
		{/if}
	</div>

	<div
		class="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-32 bg-linear-to-b from-transparent via-background/60 to-background sm:h-40"
		aria-hidden="true"
	></div>
</section>
