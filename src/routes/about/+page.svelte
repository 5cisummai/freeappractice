<script lang="ts">
	import Topbar from '$lib/components/topbar.svelte';
	import SiteFooter from '$lib/components/site-footer.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import { publicAssetUrl } from '$lib/public-assets';
	import { publicPageAssets } from '$lib/data/public-page-assets';
	import { resolve } from '$app/paths';

	const aboutImages = {
		missionPlanning: publicAssetUrl(publicPageAssets.about.missionPlanning),
		studyWorkspace: publicAssetUrl(publicPageAssets.about.studyWorkspace)
	};

	const stats = [
		{ value: '20+', label: 'AP Subjects' },
		{ value: '∞', label: 'Free Questions' },
		{ value: '2', label: 'Clicks to Start' },
		{ value: '100%', label: 'Always Free' }
	];
</script>

<svelte:head>
	<title>About – Free AP Practice</title>
	<meta
		name="description"
		content="About Free AP Practice: helping high school students plan AP classes, study over the summer, and prepare for exams with free practice."
	/>
	<link rel="canonical" href="https://freeappractice.org/about" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://freeappractice.org/about" />
	<meta property="og:title" content="About – Free AP Practice" />
	<meta
		property="og:description"
		content="About Free AP Practice: mission, approach, and core features."
	/>
	<meta property="og:image" content="https://freeappractice.org/icon.png" />
	<meta property="og:site_name" content="FreeAPPractice.org" />
	<meta property="og:locale" content="en_US" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:url" content="https://freeappractice.org/about" />
	<meta name="twitter:title" content="About – Free AP Practice" />
	<meta
		name="twitter:description"
		content="About Free AP Practice: mission, approach, and core features."
	/>
	<meta name="twitter:image" content="https://freeappractice.org/icon.png" />
</svelte:head>

<div class="flex min-h-screen flex-col bg-background text-foreground">
	<Topbar />

	<main id="main-content" class="mx-auto w-full max-w-6xl flex-1 px-5 py-14 sm:px-8 sm:py-20">
		<header class="mx-auto max-w-3xl space-y-5 text-center">
			<h1
				class="font-display text-4xl leading-[1.12] font-medium tracking-tight text-balance sm:text-5xl lg:text-[3.25rem]"
			>
				Why We Made Free AP Practice<br />
				Our Mission, Plain and Simple
			</h1>

			<p class="mx-auto max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
				We built this site so every student can get ready for AP exams without stress, fees, or
				obstacles, all with the least friction possible.
			</p>
		</header>

		<section class="mt-14 grid gap-6 lg:grid-cols-3 lg:gap-8">
			<article
				class="flex flex-col overflow-hidden rounded-2xl border border-border bg-card lg:col-span-1"
			>
				<img
					src={aboutImages.missionPlanning}
					alt="Students planning their AP study schedule with notes and a calendar"
					class="aspect-4/3 w-full object-cover"
					loading="lazy"
					decoding="async"
				/>

				<div class="flex flex-1 flex-col p-6 sm:p-8">
					<h2 class="text-xl font-semibold tracking-tight sm:text-2xl">
						Building Equitable AP Access
					</h2>
					<p class="mt-4 flex-1 text-sm leading-7 text-muted-foreground sm:text-base">
						Free AP Practice helps students pick AP classes, get a summer head start, and practice
						for exams, totally free, no subscriptions.
					</p>
					<div class="mt-8">
						<Button href={resolve('/summer')}>
							Read more
							<ArrowRightIcon class="size-4" />
						</Button>
					</div>
				</div>
			</article>

			<article class="overflow-hidden rounded-2xl border border-border bg-card lg:col-span-2">
				<div class="grid h-full lg:grid-cols-2">
					<img
						src={aboutImages.studyWorkspace}
						alt="A focused study workspace with laptop and notes"
						class="h-full min-h-56 w-full object-cover lg:min-h-full"
						loading="lazy"
						decoding="async"
					/>

					<div class="flex flex-col justify-center p-6 sm:p-8">
						<h2 class="text-xl font-semibold tracking-tight sm:text-2xl">
							Transforming How Students Practice
						</h2>
						<p class="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
							AI makes questions as you practice. Guides and cached questions get you started fast,
							with progress tracking built in. All free with all core features to remain that way.
						</p>

						<div class="mt-8 grid grid-cols-2 gap-3 sm:gap-4">
							{#each stats as stat (stat.label)}
								<div
									class="rounded-xl border border-border bg-background px-4 py-5 sm:px-5 sm:py-6"
								>
									<p class="text-2xl font-semibold tracking-tight sm:text-3xl">{stat.value}</p>
									<p class="mt-1 text-sm text-muted-foreground">{stat.label}</p>
								</div>
							{/each}
						</div>

						<div class="mt-8">
							<Button href={resolve('/app')}>
								Read more
								<ArrowRightIcon class="size-4" />
							</Button>
						</div>
					</div>
				</div>
			</article>
		</section>

		<p class="mt-12 text-center text-sm text-muted-foreground">Founded by Ajay Saravanan</p>
	</main>

	<SiteFooter />
</div>
