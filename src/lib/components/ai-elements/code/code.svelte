<script lang="ts">
	import { cn } from '$lib/utils';
	import { codeVariants } from '.';
	import type { CodeRootProps } from './types';
	import { useCode } from './code.svelte.js';
	import { box } from 'svelte-toolbelt';
	// import '../../../../routes/layout.css'

	let {
		ref = $bindable(null),
		variant = 'default',
		lang = 'typescript',
		code,
		class: className,
		hideLines = false,
		highlight = [],
		children,
		...rest
	}: CodeRootProps = $props();
	// indexing
	const codeState = useCode({
		code: box.with(() => code),
		hideLines: box.with(() => hideLines),
		highlight: box.with(() => highlight),
		lang: box.with(() => lang)
	});

	function setRef(node: HTMLDivElement) {
		ref = node;
		return () => {
			if (ref === node) ref = null;
		};
	}
</script>

<div {...rest} class={cn(codeVariants({ variant }), className)} {@attach setRef}>
	<div
		class="ai-code-wrapper [&_.line]:inline-block [&_.line]:min-h-4 [&_.line]:w-full [&_.line]:px-4 [&_.line]:py-0.5 [&_.line-numbers]:[counter-increment:step_0] [&_.line-numbers]:[counter-reset:step] [&_.line-numbers_.line]:inline-block [&_.line-numbers_.line]:min-h-4 [&_.line-numbers_.line]:w-full [&_.line-numbers_.line]:px-2 [&_.line-numbers_.line]:py-0.5 [&_.line-numbers_.line::before]:mr-[1.4rem] [&_.line-numbers_.line::before]:inline-block [&_.line-numbers_.line::before]:w-[1.8rem] [&_.line-numbers_.line::before]:text-right [&_.line-numbers_.line::before]:text-muted-foreground [&_.line-numbers_.line::before]:[content:counter(step)] [&_.line-numbers_.line::before]:[counter-increment:step] [&_.line.line--highlighted]:bg-secondary [&_.line.line--highlighted_span]:relative [&_.shiki]:overflow-x-auto [&_.shiki]:rounded-lg [&_.shiki]:bg-inherit [&_.shiki]:py-4 [&_.shiki]:text-sm dark:[&_.shiki]:!text-[var(--shiki-dark)] [&_.shiki_code]:grid [&_.shiki_code]:min-w-full [&_.shiki_code]:rounded-none [&_.shiki_code]:border-0 [&_.shiki_code]:bg-transparent [&_.shiki_code]:[box-decoration-break:clone] [&_.shiki_code]:p-0 [&_.shiki_code]:wrap-break-word dark:[&_.shiki_span]:![font-weight:var(--shiki-dark-font-weight)] dark:[&_.shiki_span]:!text-[var(--shiki-dark)] dark:[&_.shiki_span]:![font-style:var(--shiki-dark-font-style)] dark:[&_.shiki_span]:![text-decoration:var(--shiki-dark-text-decoration)] [&_.shiki:not([data-code-overflow])]:max-h-[min(100%,650px)] [&_.shiki:not([data-code-overflow])]:overflow-y-auto"
	>
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html codeState.highlighted}
		{@render children?.()}
	</div>
</div>
