<script lang="ts">
	import { renderRichTextHtml } from '$lib/content/render-rich-text';

	let {
		text = '',
		inline = false,
		class: className = ''
	}: {
		text: string;
		inline?: boolean;
		class?: string;
	} = $props();

	const renderedHtml = $derived(renderRichTextHtml(text));
</script>

{#if inline}
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	<span class="rich-text {className}">{@html renderedHtml}</span>
{:else}
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	<div class="rich-text {className}">{@html renderedHtml}</div>
{/if}

<style lang="postcss">
	@reference "../../../routes/layout.css";

	.rich-text :global(p) {
		@apply mb-2;
	}
	.rich-text :global(p:last-child) {
		@apply mb-0;
	}
	.rich-text :global(pre) {
		@apply my-2 overflow-x-auto rounded-lg text-[0.8125rem] leading-relaxed;
		padding: 0;
	}
	.rich-text :global(pre code.hljs) {
		border-radius: inherit;
	}
	.rich-text :global(code) {
		@apply font-mono text-[0.8125rem];
	}
	.rich-text :global(:not(pre) > code) {
		@apply rounded px-1.5 py-0.5;
		background: var(--color-muted);
	}
	.rich-text :global(ul) {
		@apply my-1 list-disc pl-6;
	}
	.rich-text :global(ol) {
		@apply my-1 list-decimal pl-6;
	}
	.rich-text :global(li) {
		@apply mb-0.5;
	}
	.rich-text :global(strong) {
		@apply font-semibold;
	}
	.rich-text :global(em) {
		@apply italic;
	}
	.rich-text :global(a) {
		@apply underline underline-offset-2 transition-opacity;
	}
	.rich-text :global(a:hover) {
		@apply opacity-70;
	}
	.rich-text :global(blockquote) {
		@apply my-2 border-l-4 pl-4 italic;
		border-color: var(--color-border);
		color: var(--color-muted-foreground);
	}
	.rich-text :global(h1) {
		@apply mt-4 mb-2 text-2xl font-bold;
	}
	.rich-text :global(h2) {
		@apply mt-3 mb-2 text-xl font-bold;
	}
	.rich-text :global(h3) {
		@apply mt-3 mb-1 text-lg font-semibold;
	}
	.rich-text :global(h4) {
		@apply mt-2 mb-1 text-base font-semibold;
	}
	.rich-text :global(hr) {
		@apply my-4;
		border-color: var(--color-border);
	}
	.rich-text :global(table) {
		@apply my-2 w-full border-collapse text-sm;
	}
	.rich-text :global(th) {
		@apply border px-3 py-1.5 text-left font-semibold;
		background: var(--color-muted);
		border-color: var(--color-border);
	}
	.rich-text :global(td) {
		@apply border px-3 py-1.5;
		border-color: var(--color-border);
	}
	.rich-text :global(.math-block) {
		@apply my-3 overflow-x-auto text-center;
	}
	.rich-text :global(.math-inline) {
		@apply inline;
	}
	.rich-text :global(.katex-display) {
		@apply m-0;
	}
</style>
