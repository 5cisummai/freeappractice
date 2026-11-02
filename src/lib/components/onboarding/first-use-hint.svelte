<script lang="ts">
	import * as Popover from '#lib/components/ui/popover/index.js';
	import {
		getActiveFirstUseHintId,
		getFirstUseHintQueueRevision,
		hasSeenUiHint,
		markUiHintSeen,
		type UiHintId
	} from '#lib/client/ui-hints.svelte.js';
	import { getFirstUseHintContent } from '#lib/onboarding/first-use-hint-content.js';
	import HintCard from '#lib/components/onboarding/hint-card.svelte';

	type Props = {
		id: UiHintId;
		anchorId: string;
		active?: boolean;
		skipWhenInactive?: boolean;
		description?: string;
		side?: 'top' | 'right' | 'bottom' | 'left';
		align?: 'start' | 'center' | 'end';
	};

	let {
		id,
		anchorId,
		active = true,
		skipWhenInactive = false,
		description: descriptionOverride,
		side = 'bottom',
		align = 'center'
	}: Props = $props();

	const content = $derived(getFirstUseHintContent(id));
	const description = $derived(descriptionOverride ?? content.description);

	let open = $state(false);

	function close(): void {
		if (!open) return;
		open = false;
		if (!hasSeenUiHint(id)) {
			markUiHintSeen(id);
		}
	}

	$effect(() => {
		void getFirstUseHintQueueRevision();

		if (hasSeenUiHint(id) || getActiveFirstUseHintId() !== id) {
			open = false;
			return;
		}

		if (!active) {
			if (skipWhenInactive && getActiveFirstUseHintId() === id) {
				markUiHintSeen(id);
			}
			open = false;
			return;
		}

		const anchor = document.getElementById(anchorId);
		if (!anchor) {
			open = false;
			return;
		}

		open = true;

		const onAnchorClick = () => close();
		anchor.addEventListener('click', onAnchorClick, true);
		return () => anchor.removeEventListener('click', onAnchorClick, true);
	});
</script>

<Popover.Root bind:open>
	{#if open}
		<HintCard
			customAnchor={`#${anchorId}`}
			{side}
			{align}
			sideOffset={8}
			trapFocus={false}
			onInteractOutside={close}
			aria-label={content.title}
			title={content.title}
			{description}
		/>
	{/if}
</Popover.Root>
