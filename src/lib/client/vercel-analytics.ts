import { injectAnalytics } from '@vercel/analytics/sveltekit';
import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';

let loaded = false;

export function initVercelAnalytics() {
	if (loaded || typeof window === 'undefined') return;

	injectAnalytics();
	injectSpeedInsights();
	loaded = true;
}
