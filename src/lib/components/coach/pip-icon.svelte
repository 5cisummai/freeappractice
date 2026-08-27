<script lang="ts">
	import { cn } from '$lib/utils.js';
	import {
		PIP_ICON_BODY_PATH,
		PIP_ICON_EYES,
		PIP_ICON_VIEWBOX
	} from './pip-icon-mark.js';

	let { class: className = '' }: { class?: string } = $props();
</script>

<svg
	viewBox={PIP_ICON_VIEWBOX}
	role="presentation"
	aria-hidden="true"
	class={cn('!size-4.5 shrink-0', className)}
>
	<path d={PIP_ICON_BODY_PATH} class="fill-primary" />
	{#each PIP_ICON_EYES as eye, index (index)}
		<path d={eye.d} transform={eye.matrix} fill="#fff" opacity={eye.alpha} />
	{/each}
</svg>
