import { browser } from '$app/environment';

/** Merge Tooltip.Trigger onclick with a custom handler (spread props override bare onclick). */
export function withTooltipTriggerClick(
	triggerProps: { onclick?: (e: MouseEvent) => void },
	action: () => void
) {
	return (e: MouseEvent) => {
		triggerProps.onclick?.(e);
		action();
	};
}

/** Portal an overlay node to document.body and lock scroll while mounted. */
export function portalToBody(node: HTMLElement) {
	if (!browser) return;

	const originalOverflow = document.body.style.overflow;
	document.body.appendChild(node);
	document.body.style.overflow = 'hidden';

	return {
		destroy() {
			document.body.style.overflow = originalOverflow;
			node.remove();
		}
	};
}

export function measureLongQuestion(opts: {
	prompt: string;
	node: HTMLDivElement | null;
	longQuestionThresholdChars: number;
}): boolean {
	const textLength = opts.prompt.length;
	const hasCodeBlock = /```|\n\s{2,}|<code/i.test(opts.prompt);
	const threshold = Math.min(window.innerHeight * 0.7, 600);

	let tallByLayout = false;
	if (opts.node) {
		const overflowY = getComputedStyle(opts.node).overflowY;
		const isScrollContainer = overflowY === 'auto' || overflowY === 'scroll';
		tallByLayout = isScrollContainer
			? opts.node.scrollHeight > opts.node.clientHeight + 1
			: opts.node.scrollHeight > threshold;
	}

	return textLength > opts.longQuestionThresholdChars || hasCodeBlock || tallByLayout;
}
