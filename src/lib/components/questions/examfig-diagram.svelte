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
	const imageSrc = $derived(
		renderResult.valid
			? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderResult.svg)}`
			: ''
	);
</script>

{#if renderResult.valid}
	<figure
		class={['overflow-x-auto rounded-lg border border-border/70 bg-background/70 p-3', className]}
		aria-label={spec.accessibleDescription as string}
	>
		<img
			src={imageSrc}
			alt={typeof spec.accessibleDescription === 'string' ? spec.accessibleDescription : ''}
			width={renderResult.width}
			height={renderResult.height}
			class="mx-auto h-auto max-w-full"
			decoding="async"
		/>
	</figure>
{/if}
