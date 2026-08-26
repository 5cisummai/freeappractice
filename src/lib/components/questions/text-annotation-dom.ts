import type {
	AddTextAnnotationInput,
	AnnotationTarget,
	TextAnnotation,
	TextAnnotationStyle
} from '$lib/question-bank/mcq/types';

export const ANNOTATION_ID_ATTR = 'data-text-annotation-id';
export const ANNOTATION_STYLE_ATTR = 'data-text-annotation-style';

type TextNodeSlice = {
	node: Text;
	start: number;
	end: number;
};

function createAnnotationId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `ann-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function annotationTargetMatches(a: AnnotationTarget, b: AnnotationTarget): boolean {
	if (a.kind !== b.kind) return false;
	switch (a.kind) {
		case 'prompt':
			return b.kind === 'prompt' && a.paragraphIndex === b.paragraphIndex;
		case 'stimulus':
			return b.kind === 'stimulus' && a.paragraphIndex === b.paragraphIndex;
		case 'option':
			return b.kind === 'option' && a.optionId === b.optionId;
		default: {
			const _exhaustive: never = a;
			return _exhaustive;
		}
	}
}

export function filterAnnotationsForTarget(
	annotations: readonly TextAnnotation[],
	target: AnnotationTarget
): TextAnnotation[] {
	return annotations.filter((annotation) => annotationTargetMatches(annotation.target, target));
}

export function createTextAnnotation(input: AddTextAnnotationInput): TextAnnotation | null {
	if (input.start < 0 || input.end <= input.start) return null;

	return {
		id: createAnnotationId(),
		target: input.target,
		start: input.start,
		end: input.end,
		style: input.style,
		color: input.color
	};
}

function collectTextNodeSlices(root: HTMLElement): TextNodeSlice[] {
	const slices: TextNodeSlice[] = [];
	let offset = 0;
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		const textNode = node as Text;
		const length = textNode.data.length;
		if (length === 0) continue;
		slices.push({ node: textNode, start: offset, end: offset + length });
		offset += length;
	}

	return slices;
}

function offsetWithinRoot(root: HTMLElement, container: Node, offset: number): number {
	const range = document.createRange();
	range.selectNodeContents(root);
	range.setEnd(container, offset);
	return range.toString().length;
}

export function getSelectionOffsets(root: HTMLElement): { start: number; end: number } | null {
	const selection = window.getSelection();
	if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

	const range = selection.getRangeAt(0);
	if (!root.contains(range.commonAncestorContainer)) return null;

	const selectedText = selection.toString();
	if (!selectedText.trim()) return null;

	const start = offsetWithinRoot(root, range.startContainer, range.startOffset);
	const end = offsetWithinRoot(root, range.endContainer, range.endOffset);
	if (end <= start) return null;

	return { start, end };
}

function rangeFromOffsets(root: HTMLElement, start: number, end: number): Range | null {
	if (end <= start) return null;

	const slices = collectTextNodeSlices(root);
	if (slices.length === 0) return null;

	const range = document.createRange();
	let startSet = false;

	for (const slice of slices) {
		if (!startSet && start >= slice.start && start <= slice.end) {
			range.setStart(slice.node, start - slice.start);
			startSet = true;
		}
		if (startSet && end >= slice.start && end <= slice.end) {
			range.setEnd(slice.node, end - slice.start);
			return range;
		}
	}

	return null;
}

function annotationClassName(style: TextAnnotationStyle): string {
	return style === 'strike' ? 'text-annotation-strike' : 'text-annotation-highlight';
}

export function clearAnnotationMarks(root: HTMLElement): void {
	root.querySelectorAll(`[${ANNOTATION_ID_ATTR}]`).forEach((element) => {
		const parent = element.parentNode;
		if (!parent) return;
		while (element.firstChild) {
			parent.insertBefore(element.firstChild, element);
		}
		parent.removeChild(element);
	});
}

function wrapTextRange(
	root: HTMLElement,
	start: number,
	end: number,
	id: string,
	style: TextAnnotationStyle
): void {
	const range = rangeFromOffsets(root, start, end);
	if (!range) return;

	const mark = document.createElement('mark');
	mark.setAttribute(ANNOTATION_ID_ATTR, id);
	mark.setAttribute(ANNOTATION_STYLE_ATTR, style);
	mark.className = annotationClassName(style);

	try {
		range.surroundContents(mark);
	} catch {
		const fragment = range.extractContents();
		mark.appendChild(fragment);
		range.insertNode(mark);
	}
}

export function applyAnnotationsToDom(
	root: HTMLElement,
	annotations: ReadonlyArray<Pick<TextAnnotation, 'id' | 'start' | 'end' | 'style'>>
): void {
	clearAnnotationMarks(root);

	const sorted = [...annotations].sort((a, b) => b.start - a.start);
	for (const annotation of sorted) {
		wrapTextRange(root, annotation.start, annotation.end, annotation.id, annotation.style);
	}
}

export function findAnnotationIdFromNode(node: Node | null): string | null {
	if (!node) return null;
	const element =
		node instanceof Element ? node.closest(`[${ANNOTATION_ID_ATTR}]`) : node.parentElement?.closest(`[${ANNOTATION_ID_ATTR}]`);
	return element?.getAttribute(ANNOTATION_ID_ATTR) ?? null;
}
