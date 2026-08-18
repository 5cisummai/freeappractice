<script lang="ts">
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import Button from '../controls/button.svelte';
	import PlusIcon from '@tabler/icons-svelte/icons/plus-filled';

	interface Props {
		class?: string;
		disabled?: boolean;
		'aria-label'?: string;
		children?: import('svelte').Snippet;
	}

	let { class: className, children, ...props }: Props = $props();
</script>

<DropdownMenu.Trigger>
	<Button class={className} {...props}>
		{#if children}
			{@render children()}
		{:else}
			<PlusIcon class="size-4" />
		{/if}
	</Button>
</DropdownMenu.Trigger>
