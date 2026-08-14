<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button/index.js';
	import { twAnimateInView } from '$lib/tw-animate';

	const stars = [
		{ top: '12%', left: '18%' },
		{ top: '22%', left: '72%' },
		{ top: '8%', left: '48%' },
		{ top: '16%', left: '88%' },
		{ top: '28%', left: '34%' }
	] as const;
</script>

<section class="mx-auto w-full max-w-7xl {twAnimateInView}" aria-labelledby="bottom-cta-heading">
	<div
		class="relative isolate overflow-hidden rounded-[1.75rem] bg-[#e8f1fb] px-6 py-14 sm:px-10 sm:py-16 lg:px-14 lg:py-20 dark:bg-[#091525]"
	>
		<div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
			<div
				class="absolute inset-0 bg-linear-to-br from-[#f3f8fd] via-[#e8f1fb] to-[#dce9f8] dark:from-[#0d1f42] dark:via-[#091525] dark:to-[#06101f]"
			></div>

			<svg
				class="absolute inset-0 size-full dark:hidden"
				viewBox="0 0 1200 420"
				preserveAspectRatio="xMidYMid slice"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					d="M-40 420V260c120-90 220-40 360-120s280 20 420-40 300 80 460 20v300H-40Z"
					fill="#c5e4fa"
					fill-opacity="0.95"
				/>
				<path
					d="M0 420V300c160-70 300-20 460-100s310 30 480-60 180 50 260 20v260H0Z"
					fill="#9fd0f7"
					fill-opacity="0.92"
				/>
				<path
					d="M0 420V340c220-50 380-120 560-80s340 60 520-20 120 40 120 40v140H0Z"
					fill="#78b8ef"
					fill-opacity="0.9"
				/>
				<path
					d="M0 420V360c180-30 360-100 540-70s360 80 540 40 120 30 120 30v60H0Z"
					fill="#5a9fe3"
					fill-opacity="0.88"
				/>
			</svg>

			<svg
				class="absolute inset-0 hidden size-full dark:block"
				viewBox="0 0 1200 420"
				preserveAspectRatio="xMidYMid slice"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					d="M-40 420V260c120-90 220-40 360-120s280 20 420-40 300 80 460 20v300H-40Z"
					fill="#7ec8f2"
					fill-opacity="0.95"
				/>
				<path
					d="M0 420V300c160-70 300-20 460-100s310 30 480-60 180 50 260 20v260H0Z"
					fill="#4f8fe8"
					fill-opacity="0.92"
				/>
				<path
					d="M0 420V340c220-50 380-120 560-80s340 60 520-20 120 40 120 40v140H0Z"
					fill="#2f5fae"
					fill-opacity="0.96"
				/>
				<path
					d="M0 420V360c180-30 360-100 540-70s360 80 540 40 120 30 120 30v60H0Z"
					fill="#173b78"
					fill-opacity="0.98"
				/>
			</svg>

			<div
				class="absolute inset-0 opacity-[0.08] mix-blend-overlay dark:opacity-[0.14]"
				style:background-image="radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)"
				style:background-size="3px 3px"
			></div>

			<div class="absolute inset-0">
				{#each stars as star (star.left)}
					<span
						class="absolute size-1 rounded-full bg-primary/25 dark:bg-white/70"
						style:top={star.top}
						style:left={star.left}
					></span>
				{/each}
			</div>
		</div>

		<div class="relative z-10 mx-auto flex max-w-3xl flex-col items-center text-center">
			<h2
				id="bottom-cta-heading"
				class="font-display text-[1.75rem] leading-tight font-medium tracking-tight text-balance text-foreground sm:text-4xl lg:text-[2.5rem] lg:leading-[1.15] dark:text-white"
			>
				Join students on the free AP practice platform.
				<span class="block sm:inline"> Unlimited questions with instant AI feedback.</span>
			</h2>

			<div class="mt-8 flex items-center justify-center">
				<Button href={resolve('/signup')} size="lg" variant="default">Sign up free</Button>
			</div>
		</div>
	</div>
</section>
