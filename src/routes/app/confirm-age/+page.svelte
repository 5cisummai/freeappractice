<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import PageShell from '$lib/components/layout/page-shell.svelte';
	import { apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/api.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { toast } from 'svelte-sonner';

	let saving = $state(false);

	async function confirmAge() {
		if (saving) return;
		saving = true;
		try {
			const response = await apiFetch('/api/super/confirm-age', { method: 'POST' });
			const result = await readJsonOrNull<{ error?: string }>(response);
			if (!response.ok)
				throw new Error(getResponseMessage(result, 'Could not record confirmation.'));
			toast.success('Age confirmation recorded.');
			await goto(resolve('/app/super/setup'));
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not record confirmation.');
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head><title>Confirm your age – Free AP Practice</title></svelte:head>

<PageShell
	title="Confirm your age"
	description="A quick confirmation required before using your Free AP Practice account."
>
	<div class="mx-auto w-full max-w-xl">
		<Card.Root>
			<Card.Header
				><Card.Title>Free AP Practice is for students 13 and older</Card.Title><Card.Description
					>Confirm once to continue using your account. We store only the confirmation timestamp,
					not your birth date.</Card.Description
				></Card.Header
			>
			<Card.Content class="flex flex-wrap gap-3"
				><Button onclick={confirmAge} disabled={saving}
					>{saving ? 'Saving…' : 'I am at least 13'}</Button
				><Button href={resolve('/app')} variant="outline">Go back</Button></Card.Content
			>
		</Card.Root>
	</div>
</PageShell>
