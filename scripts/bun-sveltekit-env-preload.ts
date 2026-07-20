/**
 * Bun preload so ops scripts can import SvelteKit server modules.
 * Usage: bun --preload ./scripts/bun-sveltekit-env-preload.ts scripts/...
 */
import { plugin } from 'bun';

function privateEnvExports(): string {
	const keys = [
		'DATABASE_URI',
		'OPEN_AI_KEY',
		'CRON_SECRET',
		'AWS_REGION',
		'AWS_S3_BUCKET',
		'AWS_S3_ENDPOINT',
		'AWS_S3_FORCE_PATH_STYLE',
		'AWS_ACCESS_KEY_ID',
		'AWS_SECRET_ACCESS_KEY',
		'AWS_SESSION_TOKEN',
		'RESEND_API_KEY',
		'GITHUB_BUG_REPORT_TOKEN',
		'BETTER_AUTH_SECRET',
		'BETTER_AUTH_URL',
		'FLAGS_SECRET',
		'GENERATION_MODEL',
		'TUTOR_MODEL',
		'OPENAI_BASE_URL',
		'OPENAI_URL'
	] as const;

	const lines = keys.map((key) => {
		const value = process.env[key];
		return `export const ${key} = ${value === undefined ? 'undefined' : JSON.stringify(value)};`;
	});
	lines.push('export default { ' + keys.join(', ') + ' };');
	return lines.join('\n');
}

plugin({
	name: 'sveltekit-env-shim',
	setup(build) {
		build.module('$env/static/private', () => ({
			contents: privateEnvExports(),
			loader: 'js'
		}));
		build.module('$env/dynamic/private', () => ({
			contents: `export const env = process.env;`,
			loader: 'js'
		}));
		build.module('$env/static/public', () => ({
			contents: `
				export const PUBLIC_POSTHOG_PROJECT_TOKEN = process.env.PUBLIC_POSTHOG_PROJECT_TOKEN;
				export const PUBLIC_POSTHOG_HOST = process.env.PUBLIC_POSTHOG_HOST;
				export const PUBLIC_GOOGLE_CLIENT_ID = process.env.PUBLIC_GOOGLE_CLIENT_ID;
				export const PUBLIC_DESMOS_API_KEY = process.env.PUBLIC_DESMOS_API_KEY;
			`,
			loader: 'js'
		}));
		build.module('$env/dynamic/public', () => ({
			contents: `export const env = process.env;`,
			loader: 'js'
		}));
		build.module('$app/environment', () => ({
			contents: `export const browser = false; export const building = false; export const dev = true; export const version = 'script';`,
			loader: 'js'
		}));
	}
});
