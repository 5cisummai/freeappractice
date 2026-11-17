import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	applyKitCaptureScrollFix,
	isSvelteKitClientRuntime,
	transformKitCaptureScroll,
	KIT_CAPTURE_SCROLL_ASSIGNMENT,
	KIT_CAPTURE_SCROLL_MISSING_NEEDLE_WARNING,
	KIT_CAPTURE_SCROLL_SAFE_ASSIGNMENT
} from '#lib/kit-capture-scroll-fix.js';

const kitDir = dirname(createRequire(import.meta.url).resolve('@sveltejs/kit/package.json'));
const kitClientPath = join(kitDir, 'src/runtime/client/client.js');

describe('kit capture_scroll fix', () => {
	it('still sees the unsafe assignment in the installed Kit client runtime', () => {
		const source = readFileSync(kitClientPath, 'utf8');
		expect(source.split(KIT_CAPTURE_SCROLL_ASSIGNMENT)).toHaveLength(2);
		expect(source).not.toContain(KIT_CAPTURE_SCROLL_SAFE_ASSIGNMENT);

		const patched = applyKitCaptureScrollFix(source);
		expect(patched.patched).toBe(true);
		expect(patched.code).toContain(
			'function capture_scroll(index) {\n\t(history_info[index] ??= {}).scroll = scroll_state();\n}'
		);
	});

	it('patches a missing history_info slot so capture_scroll cannot throw', () => {
		const history_info: Record<number, { scroll?: { x: number; y: number } }> = {};
		const scroll_state = () => ({ x: 0, y: 12 });
		const index = 3;

		expect(() => {
			history_info[index].scroll = scroll_state();
		}).toThrow();

		(history_info[index] ??= {}).scroll = scroll_state();
		expect(history_info[3]).toEqual({ scroll: { x: 0, y: 12 } });
	});

	it('rewrites the Kit assignment and is a no-op once already safe', () => {
		const source = `function capture_scroll(index) {\n\t${KIT_CAPTURE_SCROLL_ASSIGNMENT}\n}\n`;
		const patched = applyKitCaptureScrollFix(source);
		expect(patched.patched).toBe(true);
		expect(patched.code).toContain(KIT_CAPTURE_SCROLL_SAFE_ASSIGNMENT);
		expect(patched.code).not.toContain(`\t${KIT_CAPTURE_SCROLL_ASSIGNMENT}\n`);

		const again = applyKitCaptureScrollFix(patched.code);
		expect(again).toEqual({
			code: patched.code,
			patched: false,
			alreadySafe: true
		});
	});

	it('identifies Kit client runtime ids including query strings and Windows paths', () => {
		expect(
			isSvelteKitClientRuntime('/app/node_modules/@sveltejs/kit/src/runtime/client/client.js?v=1')
		).toBe(true);
		expect(
			isSvelteKitClientRuntime(
				'C:\\app\\node_modules\\@sveltejs\\kit\\src\\runtime\\client\\client.js'
			)
		).toBe(true);
		expect(isSvelteKitClientRuntime('/app/src/hooks.client.ts')).toBe(false);
	});

	it('transforms Kit client.js and warns when the needle is gone', () => {
		const kitClient = '/x/node_modules/@sveltejs/kit/src/runtime/client/client.js';
		expect(
			transformKitCaptureScroll(
				`function capture_scroll(index) {\n\t${KIT_CAPTURE_SCROLL_ASSIGNMENT}\n}\n`,
				kitClient
			)
		).toEqual({
			code: `function capture_scroll(index) {\n\t${KIT_CAPTURE_SCROLL_SAFE_ASSIGNMENT}\n}\n`,
			map: null
		});
		expect(transformKitCaptureScroll('function capture_scroll(index) {}\n', kitClient)).toEqual({
			warn: KIT_CAPTURE_SCROLL_MISSING_NEEDLE_WARNING
		});
		expect(
			transformKitCaptureScroll(KIT_CAPTURE_SCROLL_ASSIGNMENT, '/app/src/hooks.client.ts')
		).toBe(undefined);
	});
});
