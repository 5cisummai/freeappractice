<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/api.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import type { SuperAdminOverview } from '$lib/super/types';
	import { toast } from 'svelte-sonner';

	let { overview }: { overview: SuperAdminOverview } = $props();
	let subscriptions = $derived(overview.subscriptions);
	let failedCleanupJobs = $derived(overview.failedCleanupJobs);
	let convertingFreeBeta = $state(false);

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

	async function grantIndefiniteToFreeBetaUsers() {
		if (convertingFreeBeta) return;
		const confirmed = window.confirm(
			'Grant indefinite Super access to every user who claimed the free beta? Users who already have an indefinite grant will be skipped.'
		);
		if (!confirmed) return;
		convertingFreeBeta = true;
		try {
			const response = await apiFetch('/api/admin/super/grants/free-beta', { method: 'POST' });
			const result = await readJsonOrNull<{ granted?: number; skipped?: number; error?: string }>(
				response
			);
			if (!response.ok)
				throw new Error(getResponseMessage(result, 'Could not grant indefinite Super.'));
			await invalidateAll();
			toast.success(
				`Granted indefinite Super to ${result?.granted ?? 0} free beta user${
					(result?.granted ?? 0) === 1 ? '' : 's'
				}. Skipped ${result?.skipped ?? 0}.`
			);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not grant indefinite Super.');
		} finally {
			convertingFreeBeta = false;
		}
	}
</script>

<div class="grid gap-5">
	<p class="text-sm text-muted-foreground">
		Subscription visibility and Super operations. Per-user grants live on the Users tab. Stripe
		remains the billing authority.
	</p>
	<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
		<Card.Root class="p-5"
			><p class="text-sm text-muted-foreground">Active subscriptions</p>
			<p class="mt-2 text-3xl font-semibold">{overview.activeSubscriptions}</p></Card.Root
		>
		<Card.Root class="p-5"
			><p class="text-sm text-muted-foreground">Past due</p>
			<p class="mt-2 text-3xl font-semibold">{overview.pastDueSubscriptions}</p></Card.Root
		>
		<Card.Root class="p-5"
			><p class="text-sm text-muted-foreground">Active grants</p>
			<p class="mt-2 text-3xl font-semibold">{overview.activeGrants}</p></Card.Root
		>
		<Card.Root class="p-5"
			><p class="text-sm text-muted-foreground">AI turns · {overview.month}</p>
			<p class="mt-2 text-3xl font-semibold">{overview.personalizedMessagesThisMonth}</p></Card.Root
		>
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title>Stripe subscription detail</Card.Title>
			<Card.Description>
				Read-only mirror of Stripe webhook state. Access reason is calculated by the app entitlement
				service; Stripe remains authoritative for billing.
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
							<Button variant="outline" size="sm" onclick={() => retryCleanup(job.id)}>Retry</Button>
						</div>
					{/each}
				</div>
			{/if}
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Free beta claims</Card.Title>
			<Card.Description>
				Claims live on tutor profiles and are not grants. This converts every claimed free beta user
				into an indefinite Super grant so access survives if the beta flag is turned off. Grant or
				revoke a single user from the Users tab.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<Button onclick={grantIndefiniteToFreeBetaUsers} disabled={convertingFreeBeta}>
				{convertingFreeBeta ? 'Granting…' : 'Grant indefinite Super to all free beta users'}
			</Button>
		</Card.Content>
	</Card.Root>
</div>
