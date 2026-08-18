<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import ArrowLeftIcon from '@tabler/icons-svelte/icons/arrow-left';
	import ArrowRightIcon from '@tabler/icons-svelte/icons/arrow-right';
	import BookOpenIcon from '@tabler/icons-svelte/icons/book-filled';
	import CircleAlertIcon from '@tabler/icons-svelte/icons/alert-circle';
	import CompassIcon from '@tabler/icons-svelte/icons/compass-filled';
	import HomeIcon from '@tabler/icons-svelte/icons/home-filled';
	import KeyRoundIcon from '@tabler/icons-svelte/icons/key-filled';
	import LockKeyholeIcon from '@tabler/icons-svelte/icons/lock-filled';
	import RefreshCwIcon from '@tabler/icons-svelte/icons/refresh';
	import SearchXIcon from '@tabler/icons-svelte/icons/search-off';
	import { Button } from '$lib/components/ui/button/index.js';
	import logo from '$lib/assets/logo.png';

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
					? 'That page wandered off'
					: isServerError
						? 'A quick reset is needed'
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
						? 'Something went wrong on our end. Your work is safe. Try again in a moment or head back to practice.'
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

<main
	id="main-content"
	class="relative isolate flex min-h-svh items-center overflow-hidden bg-background px-5 py-12 sm:px-8"
>
	<div class="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
		<div class="absolute -top-32 -left-24 size-72 rounded-full bg-primary/10 blur-3xl"></div>
		<div class="absolute -right-32 -bottom-40 size-96 rounded-full bg-violet-500/10 blur-3xl"></div>
		<div
			class="absolute inset-x-0 top-1/2 h-px bg-linear-to-r from-transparent via-border/70 to-transparent"
		></div>
	</div>

	<div
		class="mx-auto flex w-full max-w-5xl flex-col items-center gap-10 lg:flex-row lg:items-stretch lg:gap-14"
	>
		<section class="flex min-w-0 flex-1 flex-col justify-center text-center lg:text-left">
			<a
				href={resolve('/')}
				class="mb-10 inline-flex items-center gap-3 self-center font-semibold tracking-tight lg:self-start"
			>
				<img src={logo} alt="Free AP Practice" class="size-8 rounded-md shadow-sm" />
				<span>Free AP Practice</span>
			</a>

			<h1
				class="max-w-xl font-display text-4xl leading-[1.04] tracking-[-0.035em] text-foreground sm:text-5xl lg:text-6xl"
			>
				{title}
			</h1>
			<p class="mx-auto mt-6 max-w-lg text-base leading-7 text-muted-foreground lg:mx-0 lg:text-lg">
				{description}
			</p>

			<div class="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
				{#if isUnauthorized}
					<Button href={resolve('/login')} size="lg">
						Sign in <ArrowRightIcon class="size-4" aria-hidden="true" />
					</Button>
				{:else if isServerError}
					<Button type="button" size="lg" onclick={retry}>
						<RefreshCwIcon class="size-4" aria-hidden="true" /> Try again
					</Button>
				{:else if isForbidden}
					<Button href={resolve('/app')} size="lg">
						Go to dashboard <ArrowRightIcon class="size-4" aria-hidden="true" />
					</Button>
				{:else}
					<Button href={resolve('/subjects')} size="lg">
						<CompassIcon class="size-4" aria-hidden="true" /> Browse subjects
					</Button>
				{/if}
				<Button href={resolve('/')} variant="outline" size="lg">
					<HomeIcon class="size-4" aria-hidden="true" /> Go home
				</Button>
			</div>

			{#if isServerError}
				<p class="mt-6 text-sm text-muted-foreground">
					Still stuck? <a
						href="mailto:support@freeappractice.org"
						class="font-medium text-foreground underline underline-offset-4 hover:text-primary"
						>Let us know</a
					>.
				</p>
			{/if}
		</section>

		<aside
			class="relative flex w-full max-w-sm shrink-0 items-center justify-center lg:w-92 lg:max-w-none"
			aria-label="Page status"
		>
			<div
				class="relative aspect-square w-full max-w-80 rotate-[-3deg] rounded-[2rem] border border-border/80 bg-card p-5 shadow-xl shadow-primary/5 sm:max-w-88"
			>
				<div
					class="absolute -top-3 -right-3 grid size-14 rotate-12 place-items-center rounded-2xl border border-primary/20 bg-primary text-primary-foreground shadow-lg shadow-primary/20"
				>
					{#if isUnauthorized}
						<KeyRoundIcon class="size-6" aria-hidden="true" />
					{:else if isForbidden}
						<LockKeyholeIcon class="size-6" aria-hidden="true" />
					{:else if isNotFound}
						<SearchXIcon class="size-6" aria-hidden="true" />
					{:else if isServerError}
						<CircleAlertIcon class="size-6" aria-hidden="true" />
					{:else}
						<RefreshCwIcon class="size-6" aria-hidden="true" />
					{/if}
				</div>

				<div
					class="flex h-full flex-col justify-between rounded-[1.35rem] border border-dashed border-primary/25 bg-primary/5 p-6"
				>
					<div
						class="flex items-center justify-between text-xs font-semibold tracking-[0.16em] text-primary uppercase"
					>
						<span>Study note</span>
						<span class="rounded-full bg-primary/10 px-2 py-1">Hmm</span>
					</div>

					<div class="space-y-5">
						<div class="space-y-2">
							<div class="h-3 w-3/4 rounded-full bg-foreground/15"></div>
							<div class="h-3 w-1/2 rounded-full bg-foreground/10"></div>
						</div>
						<div class="flex items-end gap-2">
							<div class="h-20 w-8 rounded-t-full bg-primary/25"></div>
							<div class="h-28 w-8 rounded-t-full bg-primary/45"></div>
							<div class="h-14 w-8 rounded-t-full bg-violet-500/30"></div>
							<div class="h-24 w-8 rounded-t-full bg-primary/20"></div>
							<div class="h-10 w-8 rounded-t-full bg-violet-500/20"></div>
						</div>
						<div
							class="flex items-center gap-2 border-t border-primary/15 pt-4 text-sm font-medium text-foreground"
						>
							<BookOpenIcon class="size-4 text-primary" aria-hidden="true" />
							Back to learning
						</div>
					</div>
				</div>
			</div>
		</aside>
	</div>

	<button
		type="button"
		onclick={() => history.back()}
		class="absolute top-5 left-5 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none sm:top-8 sm:left-8"
	>
		<ArrowLeftIcon class="size-4" aria-hidden="true" /> Back
	</button>
</main>
