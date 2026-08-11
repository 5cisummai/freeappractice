<script lang="ts">
	import { renderRichTextHtml } from '$lib/content/render-rich-text';
	import { toast } from 'svelte-sonner';

	let {
		text = '',
		inline = false,
		blocks = false,
		class: className = ''
	}: {
		text: string;
		inline?: boolean;
		blocks?: boolean;
		class?: string;
	} = $props();

	const renderedHtml = $derived(renderRichTextHtml(text, { blocks }));

	const languageExtensions: Record<string, string> = {
		bash: 'sh',
		sh: 'sh',
		c: 'c',
		cpp: 'cpp',
		css: 'css',
		go: 'go',
		html: 'html',
		java: 'java',
		js: 'js',
		javascript: 'js',
		json: 'json',
		jsx: 'jsx',
		markdown: 'md',
		md: 'md',
		py: 'py',
		python: 'py',
		rb: 'rb',
		ruby: 'rb',
		rs: 'rs',
		rust: 'rs',
		shell: 'sh',
		sql: 'sql',
		svelte: 'svelte',
		tsx: 'tsx',
		ts: 'ts',
		typescript: 'ts',
		xml: 'xml',
		yaml: 'yml',
		yml: 'yml'
	};

	function copyText(value: string): Promise<void> {
		if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);

		const textarea = document.createElement('textarea');
		textarea.value = value;
		textarea.setAttribute('readonly', '');
		textarea.style.position = 'fixed';
		textarea.style.opacity = '0';
		document.body.appendChild(textarea);
		textarea.select();
		const copied = document.execCommand('copy');
		textarea.remove();
		return copied ? Promise.resolve() : Promise.reject(new Error('Copy failed'));
	}

	function downloadCode(value: string, language: string): void {
		const extension = languageExtensions[language] ?? 'txt';
		const link = document.createElement('a');
		const url = URL.createObjectURL(new Blob([value], { type: 'text/plain;charset=utf-8' }));
		link.href = url;
		link.download = `code.${extension}`;
		link.style.display = 'none';
		document.body.appendChild(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(url), 0);
	}

	async function handleCodeAction(event: MouseEvent): Promise<void> {
		if (!blocks || !(event.target instanceof Element)) return;
		const button = event.target.closest<HTMLButtonElement>('[data-rich-code-action]');
		const codeBlock = button?.closest<HTMLElement>('[data-rich-code-block]');
		if (!button || !codeBlock) return;

		event.preventDefault();
		const code = codeBlock.querySelector('code')?.textContent ?? '';
		const action = button.dataset.richCodeAction;
		const language = codeBlock.dataset.language ?? 'text';
		const originalLabel = button.getAttribute('aria-label') ?? '';

		try {
			if (action === 'copy') {
				await copyText(code);
				toast.success('Code copied.');
				button.setAttribute('aria-label', 'Copied');
				button.setAttribute('title', 'Copied');
			} else if (action === 'download') {
				downloadCode(code, language);
				toast.success('Code downloaded.');
				button.setAttribute('aria-label', 'Downloaded');
				button.setAttribute('title', 'Downloaded');
			} else {
				return;
			}
			setTimeout(() => {
				if (button.isConnected) {
					button.setAttribute('aria-label', originalLabel);
					button.setAttribute('title', originalLabel);
				}
			}, 1200);
		} catch {
			toast.error(action === 'copy' ? 'Could not copy the code.' : 'Could not download the code.');
			button.setAttribute('aria-label', 'Action failed');
			button.setAttribute('title', 'Action failed');
			setTimeout(() => {
				if (button.isConnected) {
					button.setAttribute('aria-label', originalLabel);
					button.setAttribute('title', originalLabel);
				}
			}, 1200);
		}
	}

	function attachCodeActions(node: HTMLElement): () => void {
		const handleClick = (event: MouseEvent) => void handleCodeAction(event);
		node.addEventListener('click', handleClick);
		return () => node.removeEventListener('click', handleClick);
	}

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
		'[&_.katex-display]:m-0',
		'[&_.rich-code-block]:my-3',
		'[&_.rich-code-block]:overflow-hidden',
		'[&_.rich-code-block]:rounded-2xl',
		'[&_.rich-code-block]:border',
		'[&_.rich-code-block]:border-border/60',
		'[&_.rich-code-block]:bg-muted/60',
		'[&_.rich-code-block]:px-4',
		'[&_.rich-code-block]:py-3',
		'[&_.rich-code-toolbar]:flex',
		'[&_.rich-code-toolbar]:items-center',
		'[&_.rich-code-toolbar]:justify-between',
		'[&_.rich-code-toolbar]:gap-2',
		'[&_.rich-code-toolbar]:mb-3',
		'[&_.rich-code-heading]:flex',
		'[&_.rich-code-heading]:items-center',
		'[&_.rich-code-heading]:gap-3',
		'[&_.rich-code-icon]:font-mono',
		'[&_.rich-code-icon]:text-sm',
		'[&_.rich-code-icon]:font-semibold',
		'[&_.rich-code-icon]:text-muted-foreground',
		'[&_.rich-code-language]:font-mono',
		'[&_.rich-code-language]:text-sm',
		'[&_.rich-code-language]:tracking-normal',
		'[&_.rich-code-language]:text-muted-foreground',
		'[&_.rich-code-actions]:flex',
		'[&_.rich-code-actions]:items-center',
		'[&_.rich-code-actions]:gap-0.5',
		'[&_.rich-code-action]:rounded-md',
		'[&_.rich-code-action]:p-1.5',
		'[&_.rich-code-action]:font-medium',
		'[&_.rich-code-action]:text-muted-foreground',
		'[&_.rich-code-action:hover]:bg-background',
		'[&_.rich-code-action:hover]:text-foreground',
		'[&_.rich-code-action_svg]:size-4',
		'[&_.rich-code-block_pre]:m-0',
		'[&_.rich-code-block_pre]:rounded-none',
		'[&_.rich-code-block_pre]:bg-transparent',
		'[&_.rich-code-block_pre]:p-0'
	].join(' ');
</script>

{#if inline}
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	<span class={[richTextClass, className]} {@attach attachCodeActions}>{@html renderedHtml}</span>
{:else}
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	<div class={[richTextClass, className]} {@attach attachCodeActions}>{@html renderedHtml}</div>
{/if}
