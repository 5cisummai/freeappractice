import 'dotenv/config';
import adapter from '@sveltejs/adapter-vercel';
import { sentrySvelteKit } from '@sentry/sveltekit/vite';
import path, { relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { vercelToolbar } from '@vercel/toolbar/plugins/vite';
import { defineConfig } from 'vitest/config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const isVitest = Boolean(process.env.VITEST);

export default defineConfig({
	plugins: [
		...(isVitest
			? []
			: [
					sentrySvelteKit({
						org: 'free-ap-practice',
						project: 'javascript-sveltekit',
						authToken: process.env.SENTRY_AUTH_TOKEN,
						telemetry: false
					}),
					tailwindcss()
				]),

		sveltekit({
			compilerOptions: {
				// defaults to rune mode for the project, execept for `node_modules`. Can be removed in svelte 6.
				runes: ({ filename }) => {
					const relativePath = relative(import.meta.dirname, filename);
					const pathSegments = relativePath.toLowerCase().split(sep);
					const isExternalLibrary = pathSegments.includes('node_modules');

					return isExternalLibrary ? undefined : true;
				}
			},
			adapter: adapter(),
			paths: { relative: false },
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
						'https://t.freeappractice.org',
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
						'https://public.assets.freeappractice.org',
						'https://images.unsplash.com',
						'https://*.googleapis.com',
						'https://*.gstatic.com',
						'https://www.google.com',
						'https://lh3.googleusercontent.com'
					],
					'connect-src': [
						'self',
						'https://accounts.google.com',
						'https://cloudflareinsights.com',
						'https://static.cloudflareinsights.com',
						'https://va.vercel-scripts.com',
						'https://t.freeappractice.org',
						'https://us.posthog.com',
						'https://o4511759649472512.ingest.us.sentry.io'
					],
					'frame-src': ['self', 'https://accounts.google.com'],
					'worker-src': ['self', 'blob:'],
					'base-uri': ['self'],
					'form-action': ['self'],
					'object-src': ['none'],
					'frame-ancestors': ['none'],
					'upgrade-insecure-requests': true
				}
			},
			tracing: { server: true }
		}),
		...(isVitest ? [] : [vercelToolbar()])
	],
	resolve: {
		// shadcn-svelte only exports ./tailwind.css under the "style" condition,
		alias: {
			'shadcn-svelte/tailwind.css': path.resolve(
				rootDir,
				'node_modules/shadcn-svelte/dist/tailwind.css'
			)
		}
	},
	test: { include: ['tests/unit/**/*.test.ts'] }
});
