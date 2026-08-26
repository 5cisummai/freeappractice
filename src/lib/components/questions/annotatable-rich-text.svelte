<script lang="ts">
	import RichText from '$lib/components/content/rich-text.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import type {
		AddTextAnnotationInput,
		AnnotationTarget,
		TextAnnotation
	} from '$lib/question-bank/mcq/types';
	import {
		applyAnnotationsToDom,
		filterAnnotationsForTarget,
		findAnnotationIdFromNode,
		getSelectionOffsets
	} from '$lib/components/questions/text-annotation-dom.js';
	import { cn } from '$lib/utils.js';
	import HighlighterIcon from '@tabler/icons-svelte/icons/highlight';

	let {
		text,
		target,
		annotations = [],
		disabled = false,
		inline = false,
		blocks = false,
		class: className = '',
		onAddAnnotation,
		onRemoveAnnotation
	}: {
		text: string;
		target: AnnotationTarget;
		annotations?: readonly TextAnnotation[];
		disabled?: boolean;
		inline?: boolean;
		blocks?: boolean;
		class?: string;
		onAddAnnotation?: (input: AddTextAnnotationInput) => void;
		onRemoveAnnotation?: (annotationId: string) => void;
	} = $props();

	let contentRoot = $state<HTMLElement | null>(null);
	let toolbar = $state<{ x: number; y: number } | null>(null);
	let pendingSelection = $state<{ start: number; end: number } | null>(null);

	const targetAnnotations = $derived(filterAnnotationsForTarget(annotations, target));
	const canAnnotate = $derived(Boolean(onAddAnnotation) && !disabled);

	function richTextRoot(node: HTMLElement | null): HTMLElement | null {
		return node?.querySelector<HTMLElement>('.rich-text') ?? node;
	}

	function syncAnnotations(): void {
		const root = richTextRoot(contentRoot);
		if (!root) return;
		applyAnnotationsToDom(root, targetAnnotations);
	}

	function clearSelectionUi(): void {
		toolbar = null;
		pendingSelection = null;
	}

	function handleMouseUp(event: MouseEvent): void {
		if (!canAnnotate || !contentRoot) return;

		const annotationId = findAnnotationIdFromNode(event.target as Node);
		if (annotationId && onRemoveAnnotation) {
			event.stopPropagation();
			onRemoveAnnotation(annotationId);
			window.getSelection()?.removeAllRanges();
			clearSelectionUi();
			return;
		}

		const root = richTextRoot(contentRoot);
		if (!root) return;

		const offsets = getSelectionOffsets(root);
		if (!offsets) {
			clearSelectionUi();
			return;
		}

		pendingSelection = offsets;
		const selection = window.getSelection();
		const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
		if (!range) return;

		const rect = range.getBoundingClientRect();
		toolbar = {
			x: rect.left + rect.width / 2,
			y: Math.max(8, rect.top - 8)
		};
	}

	function highlightSelection(): void {
		if (!pendingSelection || !onAddAnnotation) return;

		onAddAnnotation({
			target,
			start: pendingSelection.start,
			end: pendingSelection.end,
			style: 'highlight'
		});
		window.getSelection()?.removeAllRanges();
		clearSelectionUi();
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			window.getSelection()?.removeAllRanges();
			clearSelectionUi();
		}
	}

	$effect(() => {
		void text;
		void targetAnnotations;
		queueMicrotask(() => syncAnnotations());
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="relative">
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		bind:this={contentRoot}
		role="group"
		class={cn(canAnnotate && 'cursor-text select-text', className)}
		onmouseup={handleMouseUp}
	>
		<RichText {text} {inline} {blocks} />
	</div>

	{#if toolbar && canAnnotate}
		<div
			class="fixed z-[100] -translate-x-1/2 -translate-y-full rounded-md border border-border bg-popover p-1 shadow-md"
			style:left="{toolbar.x}px"
			style:top="{toolbar.y}px"
			role="toolbar"
			aria-label="Text highlight tools"
		>
			<Button type="button" variant="ghost" size="sm" class="h-8 gap-1.5 px-2.5" onclick={highlightSelection}>
				<HighlighterIcon class="size-4 text-amber-600 dark:text-amber-400" />
				Highlight
			</Button>
		</div>
	{/if}
</div>
