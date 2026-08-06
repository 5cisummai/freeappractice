<script lang="ts">
	import { onMount } from 'svelte';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { hasSeenUiHint, markUiHintSeen, type UiHintId } from '$lib/client/ui-hints.svelte.js';

	type Props = {
		id: UiHintId;
		anchorId: string;
		text: string;
		side?: 'top' | 'right' | 'bottom' | 'left';
		align?: 'start' | 'center' | 'end';
	};

	let { id, anchorId, text, side = 'bottom', align = 'center' }: Props = $props();
	let open = $state(false);

	function close(): void {
		open = false;
	}

	onMount(() => {
		const anchor = document.getElementById(anchorId);
		if (!anchor || hasSeenUiHint(id)) return;

		markUiHintSeen(id);
		open = true;

		anchor.addEventListener('click', close, true);
		return () => anchor.removeEventListener('click', close, true);
	});
</script>

<Popover.Root bind:open>
	{#if open}
		<Popover.Content
			customAnchor={`#${anchorId}`}
			{side}
			{align}
			sideOffset={8}
			trapFocus={false}
			onInteractOutside={close}
			aria-label="Helpful tip"
			class="w-auto max-w-[min(18rem,calc(100vw-2rem))] gap-0 rounded-lg px-3 py-2 text-sm leading-5 shadow-lg"
		>
			{text}
		</Popover.Content>
	{/if}
</Popover.Root>
