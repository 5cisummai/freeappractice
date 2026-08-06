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
	const richTextClass = [
		'rich-text',
		'[&_p]:mb-2',
		'[&_p:last-child]:mb-0',
		'[&_pre]:my-2',
		'[&_pre]:overflow-x-auto',
		'[&_pre]:rounded-lg',
		'[&_pre]:p-0',
		'[&_pre]:text-[0.8125rem]',
		'[&_pre]:leading-relaxed',
		'[&_pre_code.hljs]:rounded-[inherit]',
		'[&_code]:font-mono',
		'[&_code]:text-[0.8125rem]',
		'[&_code:not(pre_code)]:rounded',
		'[&_code:not(pre_code)]:bg-muted',
		'[&_code:not(pre_code)]:px-1.5',
		'[&_code:not(pre_code)]:py-0.5',
		'[&_ul]:my-1',
		'[&_ul]:list-disc',
		'[&_ul]:pl-6',
		'[&_ol]:my-1',
		'[&_ol]:list-decimal',
		'[&_ol]:pl-6',
		'[&_li]:mb-0.5',
		'[&_strong]:font-semibold',
		'[&_em]:italic',
		'[&_a]:underline',
		'[&_a]:underline-offset-2',
		'[&_a]:transition-opacity',
		'[&_a:hover]:opacity-70',
		'[&_blockquote]:my-2',
		'[&_blockquote]:border-l-4',
		'[&_blockquote]:border-border',
		'[&_blockquote]:pl-4',
		'[&_blockquote]:text-muted-foreground',
		'[&_blockquote]:italic',
		'[&_h1]:mt-4',
		'[&_h1]:mb-2',
		'[&_h1]:text-2xl',
		'[&_h1]:font-bold',
		'[&_h2]:mt-3',
		'[&_h2]:mb-2',
		'[&_h2]:text-xl',
		'[&_h2]:font-bold',
		'[&_h3]:mt-3',
		'[&_h3]:mb-1',
		'[&_h3]:text-lg',
		'[&_h3]:font-semibold',
		'[&_h4]:mt-2',
		'[&_h4]:mb-1',
		'[&_h4]:text-base',
		'[&_h4]:font-semibold',
		'[&_hr]:my-4',
		'[&_hr]:border-border',
		'[&_table]:my-2',
		'[&_table]:w-full',
		'[&_table]:border-collapse',
		'[&_table]:text-sm',
		'[&_th]:border',
		'[&_th]:border-border',
		'[&_th]:bg-muted',
		'[&_th]:px-3',
		'[&_th]:py-1.5',
		'[&_th]:text-left',
		'[&_th]:font-semibold',
		'[&_td]:border',
		'[&_td]:border-border',
		'[&_td]:px-3',
		'[&_td]:py-1.5',
		'[&_.math-block]:my-3',
		'[&_.math-block]:overflow-x-auto',
		'[&_.math-block]:text-center',
		'[&_.math-inline]:inline',
		'[&_.katex-display]:m-0'
	].join(' ');
</script>

{#if inline}
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	<span class={[richTextClass, className]}>{@html renderedHtml}</span>
{:else}
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	<div class={[richTextClass, className]}>{@html renderedHtml}</div>
{/if}
