<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button/index.js';
	import XIcon from '@lucide/svelte/icons/x';

	let dismissed = $state(false);

	const invited = $derived(page.url.searchParams.get('invited') === '1');
	const showBanner = $derived(invited && !dismissed);
</script>

{#if showBanner}
	<div
		class="mt-6 mb-0 flex flex-col gap-3 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
		role="status"
	>
		<div class="space-y-1 pr-2">
			<p class="font-medium text-foreground">A classmate shared Free AP Practice with you</p>
			<p class="text-sm text-muted-foreground">
				Pick your subject, generate a question, and start practicing—no signup required to try it.
			</p>
		</div>
		<div class="flex shrink-0 items-center gap-2">
			<Button href={resolve('/signup')} class="rounded-full">Save your progress</Button>
			<Button
				variant="ghost"
				size="icon"
				class="rounded-full"
				aria-label="Dismiss invite message"
				onclick={() => (dismissed = true)}
			>
				<XIcon class="size-4" />
			</Button>
		</div>
	</div>
{/if}
