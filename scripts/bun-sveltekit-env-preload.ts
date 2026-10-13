/**
 * Bun preload so ops scripts can import SvelteKit server modules.
 * Usage: bun --preload ./scripts/bun-sveltekit-env-preload.ts scripts/...
 */
import { plugin } from 'bun';
import { variables } from '../src/env.ts';

function envExports(isPublic: boolean): string {
	const keys = Object.entries(variables)
		.filter(([, config]) => ('public' in config && config.public === true) === isPublic)
		.map(([key]) => key);
	return keys
		.map((key) => {
			const value = process.env[key];
			return `export const ${key} = ${value === undefined ? 'undefined' : JSON.stringify(value)};`;
		})
		.join('\n');
}

plugin({
	name: 'sveltekit-env-shim',
	setup(build) {
		build.module('$app/env/private', () => ({
			contents: envExports(false),
			loader: 'js'
		}));
		build.module('$app/env/public', () => ({
			contents: envExports(true),
			loader: 'js'
		}));
		build.module('$app/env', () => ({
			contents: `export const browser = false; export const building = false; export const dev = true; export const version = 'script';`,
			loader: 'js'
		}));
	}
});
