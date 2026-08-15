<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';

	let { freeBeta = false, children }: { freeBeta?: boolean; children?: Snippet } = $props();

	const superSignupHref = `${resolve('/signup')}?super=1`;
	const badgeClass =
		'inline-flex items-center gap-1.5 rounded-full border border-violet-300/50 super-tier-gradient px-3 py-1.5 text-xs font-semibold text-violet-700 shadow-sm shadow-violet-500/10 dark:text-violet-300';
</script>

<section
	id="hero"
	class="relative isolate z-0 -mt-14 flex min-h-svh flex-col items-center overflow-visible bg-background px-5 pt-24 pb-12 sm:px-8 sm:pt-28 sm:pb-16 lg:px-10 lg:pt-32"
>
	<div
		class="pointer-events-none absolute inset-x-0 top-0 -z-20 h-svh overflow-hidden mask-[linear-gradient(to_bottom,black_55%,transparent)]"
		aria-hidden="true"
	>
		<img
			src="/illustrations/hero-landscape.webp"
			alt=""
			width="1536"
			height="1024"
			fetchpriority="high"
			decoding="async"
			class="size-full object-cover object-[center_72%] dark:hidden"
		/>
		<img
			src="/illustrations/hero-landscape-dark.webp"
			alt=""
			width="1536"
			height="1024"
			fetchpriority="high"
			decoding="async"
			class="hidden size-full object-cover object-[center_72%] dark:block"
		/>
		<div
			class="absolute inset-0 bg-linear-to-b from-[#f7f3ec]/50 via-transparent to-transparent dark:from-background/70"
		></div>
	</div>

	<div class="relative flex w-full max-w-5xl flex-col items-center">
		<div class="flex max-w-3xl flex-col items-center space-y-5 text-center">
			{#if freeBeta}
				<a
					href={superSignupHref}
					class="{badgeClass} super-tier-gradient-hover transition-colors hover:border-violet-400/70"
				>
					<SparklesIcon class="size-3.5 text-violet-500 dark:text-violet-400" aria-hidden="true" />
					Claim Free Super Beta
					<ArrowRightIcon
						class="size-3.5 text-violet-500 dark:text-violet-400"
						aria-hidden="true"
					/>
				</a>
			{:else}
				<span class={badgeClass}>
					<SparklesIcon class="size-3.5 text-violet-500 dark:text-violet-400" aria-hidden="true" />
					Super
				</span>
			{/if}

			<h1
				class="font-display text-[2.15rem] leading-[1.15] font-semibold tracking-tight text-balance text-foreground sm:text-5xl lg:text-6xl"
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
							d="M2 7.2c12.5-3.8 26.4 1.6 39.2-.4C54.2 5 66.8 2.1 86 6.4"
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
				Unlimited exam-style questions with personalized feedback across 20+ AP subjects.
			</p>
		</div>

		{#if children}
			<div class="mt-8 w-full sm:mt-10">
				{@render children()}
			</div>
		{/if}
	</div>
</section>
