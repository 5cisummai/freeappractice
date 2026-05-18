// Force SSR so SvelteKit injects a nonce into the page's CSP header,
// which hooks.server.ts then extends with 'unsafe-eval' for this route.
export const prerender = false;
