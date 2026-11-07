import { PUBLIC_DESMOS_API_KEY } from '$app/env/public';
import { resolveDesmosApiKey } from '#lib/desmos/config.js';
import type { PageServerLoad } from './$types';

// Force SSR so SvelteKit injects a nonce into the page's CSP header,
// which hooks.server.ts then extends with 'unsafe-eval' for this route.
// Runtime (non-static) PUBLIC_DESMOS_API_KEY is also read here per request
// instead of being inlined into the client bundle at build time.
export const prerender = false;

export const load: PageServerLoad = () => {
	return {
		apiKey: resolveDesmosApiKey(PUBLIC_DESMOS_API_KEY)
	};
};
