<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import Share2Icon from '@lucide/svelte/icons/share-2';
	import UsersIcon from '@lucide/svelte/icons/users';
	import { capturePostHogEvent } from '$lib/client/posthog-analytics';

	type ReferralCardVariant = 'default' | 'compact' | 'sidebar';

	let {
		shareUrl,
		studentsHelped,
		pendingInvites = 0,
		compact = false,
		variant = 'default'
	}: {
		shareUrl: string;
		studentsHelped: number;
		pendingInvites?: number;
		/** @deprecated use variant="compact" */
		compact?: boolean;
		variant?: ReferralCardVariant;
	} = $props();

	const resolvedVariant = $derived(compact ? 'compact' : variant);

	let copied = $state(false);

	async function copyLink(): Promise<void> {
		await navigator.clipboard.writeText(shareUrl);
		copied = true;
		capturePostHogEvent('referral_share', { method: 'copy' });
		window.setTimeout(() => (copied = false), 2000);
	}

	async function share(): Promise<void> {
		const text = 'Free AP practice questions with instant feedback and no paywall.';
		if (navigator.share) {
			try {
				await navigator.share({ title: 'Free AP Practice', text, url: shareUrl });
				capturePostHogEvent('referral_share', { method: 'native_share' });
				return;
			} catch {
				// A dismissed share sheet should not surface an error.
			}
		}

		await copyLink();
	}

	const statusLine = $derived.by(() => {
		if (studentsHelped > 0) {
			const helped = `Helped ${studentsHelped} ${studentsHelped === 1 ? 'student' : 'students'}`;
			if (pendingInvites > 0) {
				return `${helped} · ${pendingInvites} pending`;
			}
			return helped;
		}
		if (pendingInvites > 0) {
			return `${pendingInvites} ${pendingInvites === 1 ? 'invite' : 'invites'} pending`;
		}
		return null;
	});
</script>

{#if resolvedVariant === 'sidebar'}
	<div class="rounded-xl border border-sidebar-border bg-sidebar-accent/30 p-3.5">
		<p class="flex items-start gap-2 text-sm leading-snug text-sidebar-foreground/90">
			<UsersIcon class="mt-0.5 size-4 shrink-0 opacity-70" aria-hidden="true" />
			<span>Share Free AP Practice with a classmate</span>
		</p>
		{#if statusLine}
			<p class="mt-1.5 pl-6 text-xs text-sidebar-foreground/65">{statusLine}</p>
		{/if}
		<div class="mt-3 flex gap-2">
			<Button onclick={copyLink} size="sm" class="h-8 flex-1" variant="ghost">
				<CopyIcon class="size-3.5" />
				{copied ? 'Copied' : 'Copy'}
			</Button>
			<Button onclick={share} size="sm" class="h-8 flex-1">
				<Share2Icon class="size-3.5" />
				Share
			</Button>
		</div>
	</div>
{:else}
	<Card.Root
		class={
			resolvedVariant === 'compact'
				? 'rounded-2xl border border-primary/20 bg-primary/3 p-4 shadow-sm ring-0'
				: 'rounded-2xl border border-primary/20 bg-primary/3 p-5 shadow-sm ring-0'
		}
	>
		<div class="flex flex-col gap-3">
			<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div class="flex gap-3">
					<div
						class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
					>
						<UsersIcon class="size-5" />
					</div>
					<div class="space-y-1">
						<p class="font-medium">
							{resolvedVariant === 'compact'
								? 'Know someone studying for AP?'
								: 'Help another student practice'}
						</p>
						{#if studentsHelped > 0}
							<p class="text-sm text-muted-foreground">
								You’ve helped {studentsHelped}
								{studentsHelped === 1 ? 'student' : 'students'} start practicing.
								{#if pendingInvites > 0}
									{pendingInvites}
									{pendingInvites === 1 ? 'invite is' : 'invites are'} still getting started.
								{/if}
							</p>
						{:else if pendingInvites > 0}
							<p class="text-sm text-muted-foreground">
								{pendingInvites}
								{pendingInvites === 1 ? 'classmate signed up' : 'classmates signed up'} — they’ll
								count once they answer a question.
							</p>
						{:else}
							<p class="text-sm text-muted-foreground">
								Share free AP practice—no paywalls, no strings attached.
							</p>
						{/if}
					</div>
				</div>
				<div class="flex shrink-0 gap-2">
					<Button onclick={copyLink} variant="outline" class="rounded-full">
						<CopyIcon />
						{copied ? 'Copied' : 'Copy'}
					</Button>
					<Button onclick={share} class="rounded-full">
						<Share2Icon /> Share
					</Button>
				</div>
			</div>
		</div>
	</Card.Root>
{/if}
