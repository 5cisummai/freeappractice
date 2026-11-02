<script lang="ts">
	import { invalidateAuthenticatedShell } from '#lib/client/invalidate-data.js';
	import SparklesIcon from '@tabler/icons-svelte/icons/sparkles-filled';
	import CheckIcon from '@tabler/icons-svelte/icons/check-filled';
	import { toast } from 'svelte-sonner';
	import { apiFetch, getResponseMessage, readJsonOrNull } from '#lib/client/api.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { SUPER_GRADIENT_BUTTON_CLASS } from '#lib/components/agent/ui.js';

	let {
		open = $bindable(true)
	}: {
		open?: boolean;
	} = $props();

	let claiming = $state(false);

	const superFeatures = [
		'AI Coach personalized to your practice',
		'Weekly study plans you approve with Coach',
		'Unlimited practice and Tutor stay free'
	] as const;

	async function claimOffer() {
		if (claiming) return;
		claiming = true;
		try {
			const response = await apiFetch('/api/super/claim-free-beta', { method: 'POST' });
			const result = await readJsonOrNull<{ error?: string; claimed?: boolean }>(response);
			if (!response.ok) {
				throw new Error(getResponseMessage(result, 'Could not claim the free Super offer.'));
			}
			toast.success('Super unlocked. Enjoy the free beta!');
			open = false;
			await invalidateAuthenticatedShell();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not claim the free Super offer.');
		} finally {
			claiming = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md" showCloseButton={!claiming}>
		<Dialog.Header>
			<Dialog.Title class="text-center font-display text-xl tracking-tight sm:text-2xl">
				Claim your free Super offer
			</Dialog.Title>
			<Dialog.Description class="sr-only">
				Unlock Pip, weekly study plans, and personalized Coach. Practice and tutoring stay free.
			</Dialog.Description>
		</Dialog.Header>

		<ul class="flex flex-col gap-2 text-sm leading-6 text-muted-foreground">
			{#each superFeatures as feature (feature)}
				<li class="flex gap-2.5">
					<CheckIcon
						class="mt-0.5 size-4 shrink-0 text-violet-600 dark:text-violet-400"
						aria-hidden="true"
					/>
					<span>{feature}</span>
				</li>
			{/each}
		</ul>

		<Dialog.Footer class="sm:justify-center">
			<Button
				type="button"
				size="lg"
				class="w-full rounded-full {SUPER_GRADIENT_BUTTON_CLASS}"
				onclick={claimOffer}
				disabled={claiming}
			>
				<SparklesIcon class="size-4" />
				{claiming ? 'Claiming…' : 'Claim free Super'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
