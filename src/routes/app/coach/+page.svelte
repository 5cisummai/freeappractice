<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import CoachShell from '$lib/components/super/coach-shell.svelte';

	let { data } = $props();
</script>

<svelte:head><title>Pip | Free AP Practice</title></svelte:head>

{#if !data.hasCoachAccess}
	<div class="mx-auto max-w-2xl p-4 sm:p-8">
		<Card.Root>
			<Card.Header>
				<Card.Title>Pip</Card.Title>
				<Card.Description>Personalized planning from your practice data.</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<p class="text-sm text-muted-foreground">
					Pip is available with Super. Your free practice and progress stay exactly as they are.
				</p>
				<Button href="/pricing">See Super</Button>
			</Card.Content>
		</Card.Root>
	</div>
{:else if !data.coachEnabled}
	<div class="mx-auto max-w-2xl p-4 sm:p-8">
		<Card.Root>
			<Card.Content class="p-6 text-sm text-muted-foreground">
				Pip is temporarily unavailable. Your saved profile and study plan are unaffected.
			</Card.Content>
		</Card.Root>
	</div>
{:else if !data.profile.ageConfirmedAt}
	<div class="mx-auto max-w-2xl p-4 sm:p-8">
		<Card.Root>
			<Card.Header>
				<Card.Title>Confirm your age</Card.Title>
				<Card.Description>Pip uses personalized study information.</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<p class="text-sm text-muted-foreground">
					Pip is available to students aged 13 or older.
				</p>
				<Button href="/app/confirm-age">Confirm age</Button>
			</Card.Content>
		</Card.Root>
	</div>
{:else}
	<CoachShell surface="page" />
{/if}
