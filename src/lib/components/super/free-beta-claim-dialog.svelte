<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import SparklesIcon from '@tabler/icons-svelte/icons/sparkles-filled';
	import { toast } from 'svelte-sonner';
	import { apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/api.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { SUPER_GRADIENT_BUTTON_CLASS } from '$lib/super/ui';

	let {
		open = $bindable(false)
	}: {
		open?: boolean;
	} = $props();

	let claiming = $state(false);

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
			await invalidateAll();
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
			<div
				class="mx-auto mb-1 flex size-12 items-center justify-center rounded-full border border-violet-300/50 super-tier-gradient text-violet-700 shadow-sm shadow-violet-500/10 dark:text-violet-300"
			>
				<SparklesIcon class="size-5" />
			</div>
			<Dialog.Title class="text-center font-display text-xl tracking-tight sm:text-2xl">
				Claim your free Super offer
			</Dialog.Title>
			<Dialog.Description class="text-center text-sm leading-6">
				Unlock personalized tutoring, AI Coach, insights, weekly study plans, and 300 personalized
				messages a month.
			</Dialog.Description>
		</Dialog.Header>

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
