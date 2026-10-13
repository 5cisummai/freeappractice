import prettier from 'eslint-config-prettier';
import path from 'node:path';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';
import oxlint from 'eslint-plugin-oxlint';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

// Serializable subset for ESLint only — the sveltekit() options in vite.config.ts have functions that break --cache.
const eslintSvelteConfig = {
	compilerOptions: { runes: true }
};

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off',
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
		}
	},
	{
		// These modules intentionally bridge Drizzle's dynamic query API and
		// hydrated domain documents. Keep explicit-any checks enabled elsewhere.
		files: [
			'src/lib/admin/dashboard.server.ts',
			'src/lib/grading/frq/storage.server.ts',
			'src/lib/question-bank/frq/model.server.ts',
			'src/lib/question-bank/quality/models.server.ts',
			'src/lib/question-bank/quality/service.server.ts',
			'src/lib/question-bank/mcq/repository.server.ts',
			'src/lib/question-bank/gen-stats.server.ts',
			'src/lib/question-bank/pool-refill.server.ts',
			'src/lib/question-bank/recent-topic.server.ts',
			'src/lib/server/neon/model.ts',
			'src/lib/agent/personalization/profile.server.ts',
			'src/lib/agent/plans/store.server.ts',
			'src/lib/users/model.server.ts'
		],
		rules: {
			'@typescript-eslint/no-explicit-any': 'off'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
				svelteConfig: eslintSvelteConfig
			}
		}
	},
	// Keep full template-aware checks for Svelte components; Oxlint owns JS/TS rules.
	...oxlint
		.buildFromOxlintConfigFile('./.oxlintrc.json')
		.filter((config) => config.rules)
		.map((config) => ({
			...config,
			ignores: [...(config.ignores ?? []), '**/*.svelte']
		})),
	{
		files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
		// Oxlint reads the existing ESLint disable comments for migrated rules.
		linterOptions: { reportUnusedDisableDirectives: 'off' }
	}
);
