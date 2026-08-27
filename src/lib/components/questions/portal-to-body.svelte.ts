import { browser } from '$app/environment';
import type { Attachment } from 'svelte/attachments';

/**
 * Portal an element to document.body and lock page scroll while enabled.
 * Implemented as an attachment so cleanup still runs after the node is moved.
 */
export function portalToBody(enabled = true): Attachment<HTMLElement> {
	return (node) => {
		if (!browser) return;

		const parent = node.parentNode;
		const anchor = document.createComment('portal-anchor');
		const originalOverflow = document.body.style.overflow;
		let isPortaled = false;

		function restoreBodyOverflow(): void {
			document.body.style.overflow = originalOverflow;
		}

		function detachPortal(): void {
			if (!isPortaled) return;

			if (anchor.parentNode) {
				anchor.parentNode.insertBefore(node, anchor);
				anchor.remove();
			} else if (node.isConnected) {
				node.remove();
				anchor.remove();
			} else {
				anchor.remove();
			}

			restoreBodyOverflow();
			isPortaled = false;
		}

		function setPortaled(nextEnabled: boolean): void {
			if (nextEnabled === isPortaled) return;

			if (nextEnabled) {
				parent?.insertBefore(anchor, node);
				document.body.appendChild(node);
				document.body.style.overflow = 'hidden';
				isPortaled = true;
				return;
			}

			detachPortal();
		}

		$effect(() => {
			setPortaled(enabled);
			return () => {
				detachPortal();
			};
		});
	};
}
