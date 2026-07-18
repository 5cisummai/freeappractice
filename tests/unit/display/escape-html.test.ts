import { describe, expect, it } from 'vitest';
import { escapeHtml } from '$lib/escape-html';

describe('escapeHtml', () => {
	it('escapes HTML special characters', () => {
		expect(escapeHtml(`<a href="x" title='y'>&`)).toBe(
			'&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;'
		);
	});
});
