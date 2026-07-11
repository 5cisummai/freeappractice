<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import Share2Icon from '@lucide/svelte/icons/share-2';
	import UsersIcon from '@lucide/svelte/icons/users';

	let { shareUrl, studentsHelped }: { shareUrl: string; studentsHelped: number } = $props();
	let copied = $state(false);

	async function share(): Promise<void> {
		const text = 'Free AP practice questions with instant feedback and no paywall.';
		if (navigator.share) {
			try {
				await navigator.share({ title: 'Free AP Practice', text, url: shareUrl });
				return;
			} catch {
				// A dismissed share sheet should not surface an error.
			}
		}

		await navigator.clipboard.writeText(shareUrl);
		copied = true;
		window.setTimeout(() => (copied = false), 2000);
	}
</script>

<Card.Root class="rounded-2xl border border-primary/20 bg-primary/3 p-5 shadow-sm ring-0">
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div class="flex gap-3">
			<div
				class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
			>
				<UsersIcon class="size-5" />
			</div>
			<div class="space-y-1">
				<p class="font-medium">Help another student practice</p>
				{#if studentsHelped > 0}
					<p class="text-sm text-muted-foreground">
						You’ve helped {studentsHelped}
						{studentsHelped === 1 ? 'student' : 'students'} start practicing.
					</p>
				{:else}
					<p class="text-sm text-muted-foreground">
						Share free AP practice—no paywalls, no strings attached.
					</p>
				{/if}
			</div>
		</div>
		<Button onclick={share} variant="outline" class="shrink-0 rounded-full">
			{#if copied}
				<CopyIcon /> Link copied
			{:else}
				<Share2Icon /> Share your link
			{/if}
		</Button>
	</div>
</Card.Root>
