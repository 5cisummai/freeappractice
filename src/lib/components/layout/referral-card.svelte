<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import Share2Icon from '@lucide/svelte/icons/share-2';
	import UsersIcon from '@lucide/svelte/icons/users';
	import { capturePostHogEvent } from '$lib/client/posthog-analytics';

	let {
		shareUrl,
		studentsHelped,
		pendingInvites = 0
	}: {
		shareUrl: string;
		studentsHelped: number;
		pendingInvites?: number;
	} = $props();

	type CopyStatus = 'idle' | 'copied' | 'error';

	let copyStatus = $state<CopyStatus>('idle');
	const copyLabel = $derived(
		copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Copy failed' : 'Copy'
	);
	const copyMessage = $derived(
		copyStatus === 'error' ? 'Could not copy the invite link. Please try again.' : ''
	);

	function wasShareDismissed(error: unknown): boolean {
		return error instanceof DOMException && error.name === 'AbortError';
	}

	async function copyLink(): Promise<boolean> {
		copyStatus = 'idle';

		if (!navigator.clipboard?.writeText) {
			copyStatus = 'error';
			return false;
		}

		try {
			await navigator.clipboard.writeText(shareUrl);
			copyStatus = 'copied';
			capturePostHogEvent('referral_share', { method: 'copy' });
			return true;
		} catch {
			copyStatus = 'error';
			return false;
		}
	}

	async function share(): Promise<void> {
		const text = 'Free AP practice questions with instant feedback and no paywall.';
		copyStatus = 'idle';

		if (navigator.share) {
			try {
				await navigator.share({ title: 'Free AP Practice', text, url: shareUrl });
				capturePostHogEvent('referral_share', { method: 'native_share' });
				return;
			} catch (error) {
				// Dismissing the native sheet is an intentional no-op, not a request to copy a link.
				if (wasShareDismissed(error)) return;
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
			{copyLabel}
		</Button>
		<Button onclick={share} size="sm" class="h-8 flex-1">
			<Share2Icon class="size-3.5" />
			Share
		</Button>
	</div>
	{#if copyMessage}
		<p class="mt-2 text-xs text-sidebar-foreground/65" aria-live="polite">{copyMessage}</p>
	{/if}
</div>
