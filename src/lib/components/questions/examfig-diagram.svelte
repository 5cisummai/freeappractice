<script lang="ts">
	import { renderExamfigDiagram } from '$lib/diagrams/examfig';

	let {
		spec,
		class: className = ''
	}: {
		spec: Record<string, unknown>;
		class?: string;
	} = $props();

	const renderResult = $derived(renderExamfigDiagram(spec));
</script>

{#if renderResult.valid}
	<figure
		class={['overflow-x-auto rounded-lg border border-border/70 bg-background/70 p-3', className]}
		aria-label={spec.accessibleDescription as string}
	>
		<!-- examfig owns the SVG markup; it is validated before being serialized. -->
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html renderResult.svg}
	</figure>
{/if}
