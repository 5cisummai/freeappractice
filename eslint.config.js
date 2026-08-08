import prettier from 'eslint-config-prettier';
import path from 'node:path';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

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
		// These modules intentionally bridge Drizzle's dynamic query API and the
		// legacy document-model interface. Keep explicit-any checks enabled elsewhere.
		files: [
			'src/lib/admin/dashboard.server.ts',
			'src/lib/frq/model.server.ts',
			'src/lib/question-quality/models.server.ts',
			'src/lib/question-quality/service.server.ts',
			'src/lib/questions/cache-model.server.ts',
			'src/lib/questions/gen-stats.server.ts',
			'src/lib/questions/pool-refill-model.server.ts',
			'src/lib/questions/question-id-model.server.ts',
			'src/lib/questions/recent-topic-model.server.ts',
			'src/lib/referrals/model.server.ts',
			'src/lib/server/neon/model.ts',
			'src/lib/super/models.server.ts',
			'src/lib/super/profile.server.ts',
			'src/lib/super/study-plan.server.ts',
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
				svelteConfig
			}
		}
	}
);
