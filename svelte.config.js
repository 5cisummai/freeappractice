import adapter from '@sveltejs/adapter-vercel';
import { relative, sep } from 'node:path';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// defaults to rune mode for the project, execept for `node_modules`. Can be removed in svelte 6.
		runes: ({ filename }) => {
			const relativePath = relative(import.meta.dirname, filename);
			const pathSegments = relativePath.toLowerCase().split(sep);
			const isExternalLibrary = pathSegments.includes('node_modules');

			return isExternalLibrary ? undefined : true;
		}
	},
	kit: {
		adapter: adapter(),
		csp: {
			// 'auto' uses hashes for prerendered pages and nonces for SSR pages,
			// which allows removing 'unsafe-inline' from script-src.
			mode: 'auto',
			directives: {
				'default-src': ["'self'"],
				// 'strict-dynamic' propagates nonce trust to dynamically loaded scripts
				// (Google GSI, Cloudflare beacon) without needing explicit host allowlists.
				// Host allowlists below are CSP Level 2 fallback for older browsers only —
				// CSP Level 3 browsers ignore host sources when strict-dynamic is present.
				// NOTE: 'unsafe-eval' is intentionally absent — Desmos runs in a sandboxed
				// iframe at /desmos-sandbox which gets its own CSP override in hooks.server.ts.
				'script-src': [
					"'self'",
					"'strict-dynamic'",
					// CSP2 fallbacks (ignored by CSP3 browsers when strict-dynamic is present)
					'https://accounts.google.com/gsi/client',
					'https://static.cloudflareinsights.com',
					'blob:'
				],
				// Svelte transitions inject inline styles, so 'unsafe-inline' is still required here
				'style-src': [
					"'self'",
					"'unsafe-inline'",
					// Google Identity Services injects inline styles for the sign-in button
					'https://accounts.google.com/gsi/client',
					'https://fonts.googleapis.com'
				],
				'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
				'img-src': [
					"'self'",
					'data:',
					'blob:',
					'https://freeappractice.org',
					'https://*.googleapis.com',
					'https://*.gstatic.com'
				],
				'connect-src': [
					"'self'",
					// Google Sign-In / GSI network calls
					'https://accounts.google.com',
					// Cloudflare RUM beacon (manual snippet → cloudflareinsights.com)
					'https://cloudflareinsights.com'
				],
				// Google One Tap / GSI renders in an iframe from accounts.google.com
				'frame-src': ["'self'", 'https://accounts.google.com'],
				'worker-src': ["'self'", 'blob:'],
				'base-uri': ["'self'"],
				'form-action': ["'self'"],
				'object-src': ["'none'"],
				'frame-ancestors': ["'none'"],
				'upgrade-insecure-requests': true
			}
		}
	}
};

export default config;
