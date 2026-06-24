/**
 * Shared tw-animate-css class strings.
 * @see https://github.com/Wombosvideo/tw-animate-css
 */

/** Page-load enter (hero, above-the-fold). */
export const twAnimateIn =
	'animate-in fade-in-0 slide-in-from-bottom-4 fill-mode-both duration-700 ease-out';

/** Scroll-driven enter via CSS view timeline (below-the-fold sections). */
export const twAnimateInView =
	'animate-in fade-in-0 slide-in-from-bottom-4 fill-mode-both ease-out [animation-timeline:view()] [animation-range:entry_0%_cover_40%] [animation-duration:auto]';

/** Slightly softer scroll-driven enter for dense grids. */
export const twAnimateInViewSubtle =
	'animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both ease-out [animation-timeline:view()] [animation-range:entry_0%_cover_35%] [animation-duration:auto]';

/** Scroll-driven enter with a light zoom (interactive blocks). */
export const twAnimateInViewZoom =
	'animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-3 fill-mode-both ease-out [animation-timeline:view()] [animation-range:entry_0%_cover_40%] [animation-duration:auto]';
