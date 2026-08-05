<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import PageShell from '$lib/components/layout/page-shell.svelte';
	import { authClient } from '$lib/auth/client.js';
	import { apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/api.js';
	import { toast } from 'svelte-sonner';

	let { data } = $props();

	type TargetDate = { apClass: string; targetDate: string };
	type TeachingStyle = 'socratic' | 'concise' | 'step_by_step';

	function createForm() {
		return {
			selectedClasses: data.profile.selectedApClasses.join(', '),
			targetDates: data.profile.targetDates.map((target: TargetDate) => ({
				...target
			})) as TargetDate[],
			studyAvailability: data.profile.studyAvailability,
			teachingStyle: data.profile.teachingStyle as TeachingStyle,
			memoryEnabled: Boolean(data.profile.memoryEnabled),
			ageConfirmed: Boolean(data.profile.ageConfirmedAt),
			disclosureSeen: Boolean(data.profile.memoryDisclosureSeenAt)
		};
	}

	let form = $state(createForm());
	let saving = $state(false);
	let billingBusy = $state(false);
	let annual = $state(false);
	let memories = $state<Array<{ id: string; text: string; createdAt: string | null }>>([]);
	let memoryLoading = $state(false);

	onMount(() => {
		void loadMemories();
	});

	async function loadMemories() {
		memoryLoading = true;
		try {
			const response = await apiFetch('/api/super/memory');
			const result = await readJsonOrNull<{ memories?: typeof memories; error?: string }>(response);
			if (!response.ok) throw new Error(getResponseMessage(result, 'Could not load tutor memory.'));
			memories = result?.memories ?? [];
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not load tutor memory.');
		} finally {
			memoryLoading = false;
		}
	}

	async function deleteMemory(id: string) {
		const response = await apiFetch(`/api/super/memory/${encodeURIComponent(id)}`, {
			method: 'DELETE'
		});
		const result = await readJsonOrNull<{ error?: string }>(response);
		if (!response.ok) {
			toast.error(getResponseMessage(result, 'Could not delete that memory.'));
			return;
		}
		memories = memories.filter((memory) => memory.id !== id);
		toast.success('Tutor memory deleted.');
	}

	async function deleteAllMemories() {
		if (!confirm('Delete every saved tutor memory? This cannot be undone.')) return;
		const response = await apiFetch('/api/super/memory', { method: 'DELETE' });
		const result = await readJsonOrNull<{ error?: string }>(response);
		if (!response.ok) {
			toast.error(getResponseMessage(result, 'Could not delete tutor memories.'));
			return;
		}
		memories = [];
		toast.success('All tutor memories deleted.');
	}

	function addTargetDate() {
		form.targetDates = [...form.targetDates, { apClass: '', targetDate: '' }];
	}

	function removeTargetDate(index: number) {
		form.targetDates = form.targetDates.filter((_, current) => current !== index);
	}

	async function saveProfile() {
		if (saving) return;
		saving = true;
		try {
			const response = await apiFetch('/api/super/profile', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					selectedApClasses: form.selectedClasses
						.split(',')
						.map((value) => value.trim())
						.filter(Boolean),
					targetDates: form.targetDates.filter(
						(target) => target.apClass.trim() && target.targetDate
					),
					studyAvailability: form.studyAvailability,
					teachingStyle: form.teachingStyle,
					memoryEnabled: form.memoryEnabled
				})
			});
			const result = await readJsonOrNull<{ error?: string }>(response);
			if (!response.ok)
				throw new Error(getResponseMessage(result, 'Could not save your Super profile.'));
			toast.success('Super preferences saved.');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not save your Super profile.');
		} finally {
			saving = false;
		}
	}

	async function confirmAge() {
		const response = await apiFetch('/api/super/confirm-age', { method: 'POST' });
		const result = await readJsonOrNull<{ error?: string }>(response);
		if (!response.ok) {
			toast.error(getResponseMessage(result, 'Could not record your confirmation.'));
			return;
		}
		form.ageConfirmed = true;
		toast.success('Age confirmation recorded.');
	}

	async function acknowledgeMemory() {
		const response = await apiFetch('/api/super/memory', { method: 'POST' });
		const result = await readJsonOrNull<{ error?: string }>(response);
		if (!response.ok) {
			toast.error(getResponseMessage(result, 'Could not save your memory preference.'));
			return;
		}
		form.disclosureSeen = true;
		toast.success('Memory disclosure acknowledged.');
	}

	async function startCheckout() {
		if (billingBusy) return;
		if (!form.ageConfirmed) {
			toast.error('Confirm that you are at least 13 before choosing Super.');
			return;
		}
		billingBusy = true;
		try {
			const { data: checkout, error } = await authClient.subscription.upgrade({
				plan: 'super',
				annual,
				successUrl: `${window.location.origin}${resolve('/app/super/setup')}?checkout=success`,
				cancelUrl: `${window.location.origin}${resolve('/pricing')}`,
				returnUrl: `${window.location.origin}${resolve('/app/super/setup')}`,
				disableRedirect: true
			});
			if (error || !checkout?.url) throw new Error(error?.message ?? 'Could not start checkout.');
			window.location.assign(checkout.url);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not start checkout.');
			billingBusy = false;
		}
	}

	async function manageBilling() {
		if (billingBusy) return;
		billingBusy = true;
		try {
			const { data: portal, error } = await authClient.subscription.billingPortal({
				returnUrl: `${window.location.origin}${resolve('/app/super/setup')}`,
				disableRedirect: true
			});
			if (error || !portal?.url)
				throw new Error(error?.message ?? 'Could not open billing management.');
			window.location.assign(portal.url);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not open billing management.');
			billingBusy = false;
		}
	}
</script>

<svelte:head><title>Set up Super – Free AP Practice</title></svelte:head>

<PageShell
	title="Set up Super"
	description="Choose what the tutor can use to make your study help more useful."
>
	<div class="mx-auto grid w-full max-w-3xl gap-5">
		<Card.Root>
			<Card.Header><Card.Title>Super membership</Card.Title></Card.Header>
			<Card.Content class="space-y-4">
				{#if data.entitlements.plan === 'super'}
					<p class="text-sm text-muted-foreground">
						Super is active{data.billing?.periodEnd
							? ` through ${new Date(data.billing.periodEnd).toLocaleDateString()}`
							: ''}.
						{data.billing?.cancelAtPeriodEnd
							? ' It is scheduled to cancel at the end of the period.'
							: ''}
					</p>
					<Button onclick={manageBilling} disabled={billingBusy}
						>{billingBusy ? 'Opening…' : 'Manage billing'}</Button
					>
				{:else if data.checkoutEnabled}
					<div class="flex flex-wrap items-center gap-3">
						<Button onclick={() => (annual = false)} variant={annual ? 'outline' : 'default'}
							>$9.99 monthly</Button
						>
						<Button onclick={() => (annual = true)} variant={annual ? 'default' : 'outline'}
							>$79.99 yearly</Button
						>
					</div>
					<Button onclick={startCheckout} disabled={billingBusy}
						>{billingBusy ? 'Opening checkout…' : 'Choose Super'}</Button
					>
				{:else}
					<p class="text-sm text-muted-foreground">
						New Super checkout is temporarily unavailable. Existing members keep their access.
					</p>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header><Card.Title>Age confirmation</Card.Title></Card.Header>
			<Card.Content class="flex flex-wrap items-center justify-between gap-3">
				<p class="text-sm text-muted-foreground">
					Super’s personalized AI tools are for students aged 13 or older.
				</p>
				<Button onclick={confirmAge} disabled={form.ageConfirmed}
					>{form.ageConfirmed ? 'Confirmed' : 'I am at least 13'}</Button
				>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header
				><Card.Title>Your tutoring profile</Card.Title><Card.Description
					>These preferences stay editable and guide the personalized tutor and Coach.</Card.Description
				></Card.Header
			>
			<Card.Content class="space-y-4">
				<div class="space-y-2">
					<Label for="super-classes">AP classes</Label><Input
						id="super-classes"
						bind:value={form.selectedClasses}
						placeholder="AP Biology, AP U.S. History"
					/>
				</div>
				<div class="space-y-2">
					<Label for="super-availability">Study availability</Label><Input
						id="super-availability"
						bind:value={form.studyAvailability}
						placeholder="Weeknights after 6pm; Saturday mornings"
					/>
				</div>
				<div class="space-y-2">
					<Label for="super-style">Teaching style</Label><select
						id="super-style"
						bind:value={form.teachingStyle}
						class="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
						><option value="socratic">Socratic hints</option><option value="concise"
							>Concise explanations</option
						><option value="step_by_step">Step by step</option></select
					>
				</div>
				<div class="space-y-2">
					<Label>Target dates</Label>{#each form.targetDates as target, index (index)}<div
							class="flex gap-2"
						>
							<Input bind:value={target.apClass} placeholder="AP class" /><Input
								type="date"
								bind:value={target.targetDate}
							/><Button variant="outline" size="sm" onclick={() => removeTargetDate(index)}
								>Remove</Button
							>
						</div>{/each}<Button variant="outline" size="sm" onclick={addTargetDate}
						>Add target date</Button
					>
				</div>
				<div class="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
					<div>
						<Label for="super-memory">Personalized memory</Label>
						<p class="mt-1 text-sm text-muted-foreground">
							Store learning preferences and recurring misconceptions, never full chats.
						</p>
					</div>
					<Switch
						id="super-memory"
						checked={form.memoryEnabled}
						onCheckedChange={(checked: boolean) => (form.memoryEnabled = checked)}
					/>
				</div>
				<Button onclick={saveProfile} disabled={saving}
					>{saving ? 'Saving…' : 'Save preferences'}</Button
				>
			</Card.Content>
		</Card.Root>

		<Card.Root id="tutor-memory">
			<Card.Header><Card.Title>Memory controls</Card.Title></Card.Header>
			<Card.Content class="space-y-3"
				><p class="text-sm leading-6 text-muted-foreground">
					When memory is on, the tutor can retain small learning facts such as a preferred
					explanation style or a recurring course misconception. You can pause use, review every
					saved fact, delete facts one by one, or delete all of them.
				</p>
				<div class="flex flex-wrap gap-2">
					<Button variant="outline" onclick={acknowledgeMemory}
						>{form.disclosureSeen ? 'Disclosure reviewed' : 'I understand'}</Button
					><Button href={resolve('/app/settings#tutor-memory')} variant="outline"
						>Review memory</Button
					>
				</div></Card.Content
			>
			{#if memoryLoading}
				<p class="px-6 pb-4 text-sm text-muted-foreground">Loading saved memories…</p>
			{:else if memories.length}
				<div class="space-y-2 border-t border-border px-6 py-4">
					<div class="flex items-center justify-between gap-3">
						<p class="text-sm font-medium">Saved facts</p>
						<Button variant="outline" size="sm" onclick={deleteAllMemories}>Delete all</Button>
					</div>
					{#each memories as memory (memory.id)}
						<div class="flex items-start justify-between gap-3 rounded-lg bg-muted p-3">
							<div>
								<p class="text-sm">{memory.text}</p>
								{#if memory.createdAt}<p class="mt-1 text-xs text-muted-foreground">
										Saved {new Date(memory.createdAt).toLocaleDateString()}
									</p>{/if}
							</div>
							<Button variant="ghost" size="sm" onclick={() => deleteMemory(memory.id)}
								>Delete</Button
							>
						</div>
					{/each}
				</div>
			{:else}
				<p class="border-t border-border px-6 py-4 text-sm text-muted-foreground">
					No learning facts are saved yet.
				</p>
			{/if}
		</Card.Root>
	</div>
</PageShell>
