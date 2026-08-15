import { sentrySvelteKit } from '@sentry/sveltekit';
import path from 'node:path';
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
						authToken: process.env.SENTRY_AUTH_TOKEN
					}),
					tailwindcss()
				]),
		sveltekit(),
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
	test: {
		include: ['tests/unit/**/*.test.ts']
	}
});
