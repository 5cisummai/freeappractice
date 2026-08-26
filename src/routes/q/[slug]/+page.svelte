<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import PublicShell from '$lib/components/layout/public-shell.svelte';
	import PracticeRunner from '$lib/components/practice/practice-shell.svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';

	let { data } = $props();
	let selectedClass = $state('');
	let selectedUnit = $state('');
	let requestVersion = $state(0);

	$effect(() => {
		selectedClass = data.sharedQuiz?.apClass ?? '';
		selectedUnit =
			data.sharedQuiz?.unit && data.sharedQuiz.unit !== 'All Units' ? data.sharedQuiz.unit : '';
		requestVersion = data.start && !data.isAuthenticated ? 1 : 0;
	});
	const startHref = $derived(
		data.isAuthenticated
			? `${resolve('/app/practice')}?shared=${encodeURIComponent(data.sharedQuiz?.slug ?? '')}`
			: `${page.url.pathname}?start=1`
	);
</script>

<svelte:head>
	<title>{data.sharedQuiz?.title ?? 'Shared quiz'} | Free AP Practice</title>
	<meta name="robots" content="noindex, nofollow" />
	<meta name="googlebot" content="noindex, nofollow" />
</svelte:head>

<PublicShell>
	<main id="main-content" class="flex-1">
		<div class="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8 lg:py-16">
			{#if data.sharedQuizError}
				<Card.Root class="mx-auto max-w-xl text-center">
					<Card.Header>
						<Card.Title>Shared quiz unavailable</Card.Title>
						<Card.Description>{data.sharedQuizError}</Card.Description>
					</Card.Header>
					<Card.Footer class="justify-center">
						<Button href={resolve('/')}>Start your own practice</Button>
					</Card.Footer>
				</Card.Root>
			{:else if data.sharedQuiz && data.start && !data.isAuthenticated}
				<div class="space-y-6">
					<div class="text-center">
						<p class="text-sm font-medium tracking-wide text-muted-foreground uppercase">
							Shared quiz
						</p>
						<h1 class="mt-2 font-display text-3xl font-medium tracking-tight sm:text-4xl">
							{data.sharedQuiz.title}
						</h1>
					</div>
					<PracticeRunner
						initial={{ selectedClass, selectedUnit, requestVersion }}
						quiz={{ sharedQuiz: data.sharedQuiz, persistHistory: false }}
						onEvent={(event) => {
							if (event.type === 'selection-change') {
								selectedClass = event.selectedClass;
								selectedUnit = event.selectedUnit;
							}
							if (event.type === 'quiz-exit') {
								requestVersion = 0;
								void goto(page.url.pathname);
							}
						}}
					/>
				</div>
			{:else if data.sharedQuiz}
				<Card.Root class="mx-auto max-w-xl">
					<Card.Header class="text-center">
						<Card.Title>{data.sharedQuiz.title}</Card.Title>
						<Card.Description>
							{#if data.sharedQuiz.creatorName}
								{data.sharedQuiz.creatorName} shared a quiz with you.
							{:else}
								Someone shared a quiz with you.
							{/if}
						</Card.Description>
					</Card.Header>
					<Card.Content class="space-y-4 text-center">
						<p class="text-sm text-muted-foreground">
							{data.sharedQuiz.itemCount} multiple-choice questions · {data.sharedQuiz.apClass}
						</p>
						<Button href={startHref} class="w-full">Start quiz</Button>
						{#if !data.isAuthenticated}
							<p class="text-xs text-muted-foreground">
								You can take it without an account. Sign up afterward to save your score and
								progress.
							</p>
						{/if}
					</Card.Content>
				</Card.Root>
			{/if}
		</div>
	</main>
</PublicShell>
