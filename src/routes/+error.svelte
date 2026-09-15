<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import ArrowLeftIcon from '@tabler/icons-svelte/icons/arrow-left';
	import ArrowRightIcon from '@tabler/icons-svelte/icons/arrow-right';
	import CompassIcon from '@tabler/icons-svelte/icons/compass-filled';
	import HomeIcon from '@tabler/icons-svelte/icons/home-filled';
	import RefreshCwIcon from '@tabler/icons-svelte/icons/refresh';
	import { Button } from '$lib/components/ui/button/index.js';
	import Topbar from '$lib/components/layout/topbar.svelte';

	let status = $derived(typeof page.status === 'number' ? page.status : 500);
	let isUnauthorized = $derived(status === 401);
	let isForbidden = $derived(status === 403);
	let isNotFound = $derived(status === 404);
	let isServerError = $derived(status >= 500);

	let title = $derived(
		isUnauthorized
			? 'Let’s get you signed in'
			: isForbidden
				? 'This page is off limits'
				: isNotFound
					? 'This page took a wrong turn'
					: isServerError
						? 'We hit a snag'
						: 'We couldn’t load that page'
	);

	let description = $derived(
		isUnauthorized
			? 'This page is for signed-in students. Sign in to continue, or head back to practice.'
			: isForbidden
				? 'You don’t have permission to view this page. If you think that’s a mistake, try a different account.'
				: isNotFound
					? 'We couldn’t find the page you’re looking for. It may have moved, or the link may be out of date.'
					: isServerError
						? 'Something went wrong on our end. Your work is safe. Try again in a moment, or head back to practice.'
						: 'Something about that request didn’t work. Try again, or head back to practice.'
	);

	function retry() {
		window.location.reload();
	}
</script>

<svelte:head>
	<title>{title} | Free AP Practice</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<Topbar />

<main
	id="main-content"
	class="relative isolate flex min-h-[calc(100svh_-_3.5rem)] items-center overflow-hidden bg-background px-5 py-12 text-center sm:px-8"
>
	<div class="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
		<div
			class="absolute top-0 left-1/2 h-96 w-[min(80vw,48rem)] -translate-x-1/2 rounded-full bg-primary/8 blur-3xl"
		></div>
	</div>

	<button
		type="button"
		onclick={() => history.back()}
		class="absolute top-5 left-5 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none sm:top-8 sm:left-8"
	>
		<ArrowLeftIcon class="size-4" aria-hidden="true" /> Back
	</button>

	<div class="mx-auto flex w-full max-w-xl flex-col items-center">
		<h1
			class="max-w-xl font-display text-4xl leading-[1.05] tracking-[-0.04em] text-foreground sm:text-5xl lg:text-6xl"
		>
			{title}
		</h1>
		<p class="mt-5 max-w-md text-base leading-7 text-muted-foreground sm:text-lg">
			{description}
		</p>

		<div class="mt-8 flex flex-col gap-3 sm:flex-row">
			{#if isUnauthorized}
				<Button href={resolve('/login')} size="lg" class="min-w-36">
					Sign in <ArrowRightIcon class="size-4" aria-hidden="true" />
				</Button>
			{:else if isServerError}
				<Button type="button" size="lg" class="min-w-36" onclick={retry}>
					<RefreshCwIcon class="size-4" aria-hidden="true" /> Try again
				</Button>
			{:else if isForbidden}
				<Button href={resolve('/app')} size="lg" class="min-w-36">
					Go to dashboard <ArrowRightIcon class="size-4" aria-hidden="true" />
				</Button>
			{:else}
				<Button href={resolve('/subjects')} size="lg" class="min-w-36">
					<CompassIcon class="size-4" aria-hidden="true" /> Browse subjects
				</Button>
			{/if}
			<Button href={resolve('/')} variant="outline" size="lg" class="min-w-36">
				<HomeIcon class="size-4" aria-hidden="true" /> Go home
			</Button>
		</div>

		{#if isServerError}
			<p class="mt-7 max-w-sm text-sm leading-6 text-muted-foreground">
				Still stuck? <a
					href="mailto:support@freeappractice.org"
					class="font-medium text-foreground underline underline-offset-4 hover:text-primary"
					>Let us know</a
				>.
			</p>
		{/if}
	</div>
</main>
