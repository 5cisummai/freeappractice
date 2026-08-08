<script lang="ts">
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import PageShell from '$lib/components/layout/page-shell.svelte';
	import { apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/api.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { toast } from 'svelte-sonner';

	let { data } = $props();
	let grants = $derived(data.grants);
	let subscriptions = $derived(data.subscriptions);
	let usageRollups = $derived(data.usageRollups);
	let failedCleanupJobs = $derived(data.failedCleanupJobs);
	let saving = $state(false);
	let form = $state({
		userId: '',
		startsAt: new Date().toISOString().slice(0, 16),
		expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
		reason: ''
	});

	function isoFromLocal(value: string): string {
		return new Date(value).toISOString();
	}

	async function grantAccess() {
		if (saving) return;
		saving = true;
		try {
			const response = await apiFetch('/api/admin/super/grants', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...form,
					startsAt: isoFromLocal(form.startsAt),
					expiresAt: isoFromLocal(form.expiresAt)
				})
			});
			const result = await readJsonOrNull<{ error?: string }>(response);
			if (!response.ok)
				throw new Error(getResponseMessage(result, 'Could not create Super grant.'));
			await invalidateAll();
			form = { ...form, userId: '', reason: '' };
			toast.success('Super access granted.');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not create Super grant.');
		} finally {
			saving = false;
		}
	}

	async function revokeAccess(grantId: string) {
		const response = await apiFetch('/api/admin/super/grants', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ grantId })
		});
		const result = await readJsonOrNull<{ error?: string }>(response);
		if (!response.ok) {
			toast.error(getResponseMessage(result, 'Could not revoke Super access.'));
			return;
		}
		await invalidateAll();
		toast.success('Super access revoked.');
	}

	async function retryCleanup(jobId: string) {
		const response = await apiFetch('/api/admin/super/cleanup', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ jobId })
		});
		const result = await readJsonOrNull<{ error?: string }>(response);
		if (!response.ok) {
			toast.error(getResponseMessage(result, 'Could not retry cleanup job.'));
			return;
		}
		await invalidateAll();
		toast.success('Cleanup job queued for retry.');
	}
</script>

<svelte:head><title>Super admin – Free AP Practice</title></svelte:head>

<PageShell
	title="Super admin"
	description="Subscription visibility and support grants. Stripe remains the billing authority."
>
	<div class="mx-auto grid w-full max-w-5xl gap-5">
		<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
			<Card.Root class="p-5"
				><p class="text-sm text-muted-foreground">Active subscriptions</p>
				<p class="mt-2 text-3xl font-semibold">{data.activeSubscriptions}</p></Card.Root
			>
			<Card.Root class="p-5"
				><p class="text-sm text-muted-foreground">Past due</p>
				<p class="mt-2 text-3xl font-semibold">{data.pastDueSubscriptions}</p></Card.Root
			>
			<Card.Root class="p-5"
				><p class="text-sm text-muted-foreground">Active grants</p>
				<p class="mt-2 text-3xl font-semibold">{data.activeGrants}</p></Card.Root
			>
			<Card.Root class="p-5"
				><p class="text-sm text-muted-foreground">AI turns · {data.month}</p>
				<p class="mt-2 text-3xl font-semibold">{data.personalizedMessagesThisMonth}</p></Card.Root
			>
		</div>

		<Card.Root>
			<Card.Header>
				<Card.Title>Stripe subscription detail</Card.Title>
				<Card.Description>
					Read-only mirror of Stripe webhook state. Access reason is calculated by the app
					entitlement service; Stripe remains authoritative for billing.
				</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if subscriptions.length === 0}
					<p class="text-sm text-muted-foreground">No Super subscription records.</p>
				{:else}
					<div class="divide-y divide-border rounded-lg border border-border">
						{#each subscriptions as subscription (subscription.id)}
							<div class="space-y-2 p-4 text-sm">
								<div class="flex flex-wrap items-center justify-between gap-2">
									<p class="font-medium break-all">{subscription.userId}</p>
									<span class="rounded-full border border-border px-2 py-1 text-xs"
										>{subscription.status}</span
									>
								</div>
								<p class="text-muted-foreground">
									Access reason: {subscription.accessReason ?? 'none'} ·
									{subscription.cancelAtPeriodEnd ? 'cancels at period end' : 'renews normally'}
								</p>
								<p class="text-xs break-all text-muted-foreground">
									Stripe subscription: {subscription.stripeSubscriptionId ?? 'not mirrored'} · period
									end:
									{subscription.periodEnd
										? new Date(subscription.periodEnd).toLocaleString()
										: 'unknown'}
								</p>
							</div>
						{/each}
					</div>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>Failed cleanup jobs</Card.Title>
				<Card.Description>
					Durable Mem0 cleanup failures. Retry advances the job for the maintenance worker; it does
					not delete data directly from this request.
				</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if failedCleanupJobs.length === 0}
					<p class="text-sm text-muted-foreground">No failed cleanup jobs.</p>
				{:else}
					<div class="divide-y divide-border rounded-lg border border-border">
						{#each failedCleanupJobs as job (job.id)}
							<div class="flex flex-wrap items-start justify-between gap-3 p-4 text-sm">
								<div class="min-w-0">
									<p class="font-medium break-all">{job.userId} · {job.kind}</p>
									<p class="mt-1 text-muted-foreground">Attempts: {job.attempts}</p>
									<p class="mt-1 break-words text-destructive">{job.lastError}</p>
								</div>
								<Button variant="outline" size="sm" onclick={() => retryCleanup(job.id)}
									>Retry</Button
								>
							</div>
						{/each}
					</div>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>Mongo usage rollups</Card.Title>
				<Card.Description>
					Personalized turns recorded for {data.month}. Redis remains the hot-path allowance
					control.
				</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if usageRollups.length === 0}
					<p class="text-sm text-muted-foreground">No usage rollups for this month.</p>
				{:else}
					<div class="divide-y divide-border rounded-lg border border-border">
						{#each usageRollups as rollup (rollup.userId)}
							<div class="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
								<span class="break-all">{rollup.userId}</span>
								<span class="text-muted-foreground">{rollup.personalizedMessages} turns</span>
							</div>
						{/each}
					</div>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header
				><Card.Title>Grant Super access</Card.Title><Card.Description
					>Use an existing Better Auth user ID. A grant does not create, alter, or cancel a Stripe
					subscription.</Card.Description
				></Card.Header
			>
			<Card.Content class="grid gap-4 md:grid-cols-2">
				<div class="space-y-2 md:col-span-2">
					<Label for="grant-user">User ID</Label><Input
						id="grant-user"
						bind:value={form.userId}
						placeholder="Better Auth user ID"
					/>
				</div>
				<div class="space-y-2">
					<Label for="grant-start">Starts</Label><Input
						id="grant-start"
						type="datetime-local"
						bind:value={form.startsAt}
					/>
				</div>
				<div class="space-y-2">
					<Label for="grant-end">Expires</Label><Input
						id="grant-end"
						type="datetime-local"
						bind:value={form.expiresAt}
					/>
				</div>
				<div class="space-y-2 md:col-span-2">
					<Label for="grant-reason">Support reason</Label><Input
						id="grant-reason"
						bind:value={form.reason}
						placeholder="e.g. Support replacement for a billing issue"
					/>
				</div>
				<div class="md:col-span-2">
					<Button onclick={grantAccess} disabled={saving}
						>{saving ? 'Granting…' : 'Grant Super access'}</Button
					>
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="flex-row items-center justify-between gap-4"
				><div>
					<Card.Title>Active support grants</Card.Title><Card.Description
						>Revoke immediately when the support period ends.</Card.Description
					>
				</div>
				<Button href={resolve('/app/admin')} variant="outline">Back to admin</Button></Card.Header
			>
			<Card.Content>
				{#if grants.length === 0}
					<p class="text-sm text-muted-foreground">No active Super grants.</p>
				{:else}
					<div class="divide-y divide-border rounded-lg border border-border">
						{#each grants as grant (grant.id)}
							<div class="flex flex-wrap items-center justify-between gap-3 p-4">
								<div class="min-w-0">
									<p class="text-sm font-medium break-all">{grant.userId}</p>
									<p class="mt-1 text-sm text-muted-foreground">
										{grant.reason} · expires {new Date(grant.expiresAt).toLocaleString()}
									</p>
								</div>
								<Button variant="outline" size="sm" onclick={() => revokeAccess(grant.id)}
									>Revoke</Button
								>
							</div>
						{/each}
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>
</PageShell>
