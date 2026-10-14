type AvatarSubscriber = (now: number) => void;

const subscribers = new Set<AvatarSubscriber>();
let animationFrame = 0;

function tick(now: number): void {
	animationFrame = 0;

	for (const subscriber of subscribers) {
		subscriber(now);
	}

	if (subscribers.size > 0 && animationFrame === 0) {
		animationFrame = requestAnimationFrame(tick);
	}
}

/**
 * Keeps all visible coach avatars on one browser clock instead of creating one
 * requestAnimationFrame loop per component instance.
 */
export function subscribeToAvatarTicker(subscriber: AvatarSubscriber): () => void {
	subscribers.add(subscriber);
	if (animationFrame === 0) {
		animationFrame = requestAnimationFrame(tick);
	}

	return () => {
		subscribers.delete(subscriber);
		if (subscribers.size === 0 && animationFrame !== 0) {
			cancelAnimationFrame(animationFrame);
			animationFrame = 0;
		}
	};
}
