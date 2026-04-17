import adapter from '@sveltejs/adapter-auto';
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
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter(),
		csp: {
			// 'auto' uses hashes for prerendered pages and nonces for SSR pages,
			// which allows removing 'unsafe-inline' from script-src.
			mode: 'auto',
			directives: {
				'default-src': ["'self'"],
				'script-src': [
					"'self'",
					// 'unsafe-eval' is required by Desmos and some CDN-hosted scripts
					"'unsafe-eval'",
					'https://accounts.google.com/gsi/client',
					'https://cdn.jsdelivr.net',
					'https://cdnjs.cloudflare.com',
					'https://va.vercel-scripts.com',
					'https://www.desmos.com',
					'https://static.cloudflareinsights.com',
					'blob:'
				],
				// Svelte transitions inject inline styles, so 'unsafe-inline' is still required here
				'style-src': [
					"'self'",
					"'unsafe-inline'",
					'https://accounts.google.com/gsi/client',
					'https://cdn.jsdelivr.net',
					'https://cdnjs.cloudflare.com',
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
					'https://accounts.google.com/gsi/',
					'https://va.vercel-scripts.com',
					'https://www.desmos.com',
					'https://cloudflareinsights.com',
					'blob:'
				],
				'frame-src': ['https://accounts.google.com/gsi/', 'https://www.desmos.com'],
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
