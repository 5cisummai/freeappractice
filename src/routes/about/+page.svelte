<script lang="ts">
	import Topbar from '$lib/components/topbar.svelte';
	import SiteFooter from '$lib/components/site-footer.svelte';
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>About – Free AP Practice</title>
	<meta
		name="description"
		content="About Free AP Practice: mission, approach, and core features."
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

	<main class="mx-auto w-full max-w-4xl flex-1 px-5 py-12 sm:px-8">
		<a href={resolve('/')} class="inline-block text-sm text-muted-foreground hover:text-foreground"
			>← Back to Home</a
		>

		<section class="mt-6 rounded-2xl border border-border bg-card p-8">
			<h1 class="text text-3xl font-bold tracking-tight">About Free AP Practice</h1>
			<p class="mt-4 text-base leading-relaxed text-muted-foreground">
				Free AP Practice is built to support students preparing for AP exams with fast, accurate,
				and adaptive question practice. Our platform blends on-demand AI question generation,
				preloaded question caches, and useful progress tracking in a single experience.
			</p>
		</section>

		<section class="mt-8 grid gap-6 sm:grid-cols-2">
			<article class="rounded-xl border border-border bg-card p-6">
				<h2 class="text-xl font-semibold text-primary">Mission</h2>
				<p class="mt-3 text-sm text-muted-foreground">
					Make AP prep equitable by offering smarter, instant practice for all major AP subjects
					with no subscription barrier or ads. We believe every student deserves access to
					high-quality, personalized study tools that fit their needs.
				</p>
			</article>

			<article class="rounded-xl border border-border bg-card p-6">
				<h2 class="text-xl font-semibold text-primary">Approach</h2>
				<p class="mt-3 text-sm text-muted-foreground">
					Combining local AI models, cloud fallback, and intelligent caching so students get a fast
					first question and high-quality follow-ups every session.
				</p>
			</article>

			<article class="rounded-xl border border-border bg-card p-6">
				<h2 class="text-xl font-semibold text-primary">Core Features</h2>
				<ul class="mt-3 space-y-2 text-sm text-muted-foreground">
					<li>• AI question generation across 20+ AP subjects</li>
					<li>• Randomized unit-based practice for improved retention</li>
					<li>• Local and OpenAI provider fallback for stability</li>
					<li>• Your progress saved locally-including explanations and strong/weak tracking</li>
				</ul>
			</article>

			<article class="rounded-xl border border-border bg-card p-6">
				<h2 class="text-xl font-semibold text-primary">Community</h2>
				<p class="mt-3 text-sm text-muted-foreground">
					Feedback and bug reports are welcome. We continuously improve on user testing and
					curriculum alignment so every update is better than the last.
				</p>
			</article>
		</section>

		<section class="mt-10 rounded-xl border border-border bg-card p-6">
			<h2 class="text-2xl font-semibold text-primary">How to Get Started</h2>
			<ol class="mt-4 list-inside list-decimal space-y-2 text-sm text-muted-foreground">
				<li>Select your AP subject and preferred unit range.</li>
				<li>Pick practice mode (timed, untimed, topic focused).</li>
				<li>Answer and review explanations; repeat to track improvement.</li>
			</ol>
		</section>
		<p class="mt-6 text-sm text-muted-foreground">Founded by Ajay Saravanan</p>
	</main>

	<SiteFooter />
</div>
