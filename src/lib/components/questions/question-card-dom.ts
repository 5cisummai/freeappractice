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

/** Portal a node to document.body while enabled and lock scroll while it is open. */
export function portalToBody(node: HTMLElement, enabled = true) {
	if (!browser) return;

	const parent = node.parentNode;
	const anchor = document.createComment('portal-anchor');
	const originalOverflow = document.body.style.overflow;
	let isPortaled = false;

	function setPortaled(nextEnabled: boolean): void {
		if (nextEnabled === isPortaled) return;

		if (nextEnabled) {
			parent?.insertBefore(anchor, node);
			document.body.appendChild(node);
			document.body.style.overflow = 'hidden';
			isPortaled = true;
			return;
		}

		anchor.parentNode?.insertBefore(node, anchor.nextSibling);
		anchor.remove();
		document.body.style.overflow = originalOverflow;
		isPortaled = false;
	}

	setPortaled(enabled);

	return {
		update(nextEnabled: boolean) {
			setPortaled(nextEnabled);
		},
		destroy() {
			if (isPortaled) {
				anchor.parentNode?.insertBefore(node, anchor.nextSibling);
				anchor.remove();
			}
			document.body.style.overflow = originalOverflow;
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
