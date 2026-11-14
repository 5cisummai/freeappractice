import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const appHtml = readFileSync(
	join(dirname(fileURLToPath(import.meta.url)), '../../src/app.html'),
	'utf8'
);

describe('app.html translation opt-out', () => {
	it('opts the document out of automatic translation', () => {
		expect(appHtml).toMatch(/<html\b[^>]*\blang="en"/);
		expect(appHtml).toMatch(/<html\b[^>]*\bclass="notranslate"/);
		expect(appHtml).toMatch(/<html\b[^>]*\btranslate="no"/);
		expect(appHtml).toContain('<meta name="google" content="notranslate"');
	});
});
