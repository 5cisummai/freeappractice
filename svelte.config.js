import adapter from '@sveltejs/adapter-vercel';
import { config as loadDotenv } from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { relative, sep } from 'node:path';
import { publicAssetCspOrigins } from './src/lib/public-asset-url.ts';

const projectRoot = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: join(projectRoot, '.env') });

const publicAssetImgSrc = publicAssetCspOrigins(process.env.PUBLIC_R2_ASSETS_URL);

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
			// 'auto' uses hashes for prerendered pages and nonces for SSR pages.
			// This lets SvelteKit allow its own inline runtime scripts without keeping
			// a broad script-src 'unsafe-inline' policy.
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'script-src': [
					'self',
					'https://accounts.google.com',
					'https://static.cloudflareinsights.com',
					'https://va.vercel-scripts.com',
					'unsafe-inline',
					'blob:'
				],
				// Svelte transitions and some third-party widgets inject inline styles.
				'style-src': [
					'self',
					'unsafe-inline',
					'https://accounts.google.com',
					'https://fonts.googleapis.com'
				],
				'font-src': ['self', 'https://fonts.gstatic.com', 'data:'],
				'img-src': [
					'self',
					'data:',
					'blob:',
					'https://freeappractice.org',
					'https://*.googleapis.com',
					'https://*.gstatic.com',
					...publicAssetImgSrc
				],
				'connect-src': [
					'self',
					'https://accounts.google.com',
					'https://cloudflareinsights.com',
					'https://static.cloudflareinsights.com',
					'https://va.vercel-scripts.com'
				],
				'frame-src': ['self', 'https://accounts.google.com'],
				'worker-src': ['self', 'blob:'],
				'base-uri': ['self'],
				'form-action': ['self'],
				'object-src': ['none'],
				'frame-ancestors': ['none'],
				'upgrade-insecure-requests': true
			}
		}
	}
};

export default config;
