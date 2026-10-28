import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	construct: vi.fn()
}));

vi.mock('@paper-design/shaders', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@paper-design/shaders')>();
	return {
		...actual,
		ShaderMount: class {
			constructor(...args: unknown[]) {
				mocks.construct(...args);
			}
			dispose() {}
		}
	};
});

import {
	discardFailedShaderCanvas,
	tryCreateShaderMount
} from '#lib/components/marketing/halftone-shader.js';

const WEBGL_PROGRAM_ERROR = new TypeError(
	"Argument 1 ('program') to WebGL2RenderingContext.getAttribLocation must be an instance of WebGLProgram"
);

function parentWithCanvas(): { parent: HTMLElement; canvas: { removed: boolean } } {
	const canvas = {
		removed: false,
		remove() {
			this.removed = true;
		}
	};
	const parent = {
		querySelector(selector: string) {
			return selector === ':scope > canvas' ? canvas : null;
		}
	};
	return { parent: parent as unknown as HTMLElement, canvas };
}

describe('tryCreateShaderMount', () => {
	it('returns the mount when ShaderMount constructs', () => {
		mocks.construct.mockImplementation(() => {});
		const { parent, canvas } = parentWithCanvas();
		expect(tryCreateShaderMount(parent, { u_size: 0.12 })).not.toBeNull();
		expect(canvas.removed).toBe(false);
	});

	it('swallows a null WebGL program TypeError and removes the leftover canvas', () => {
		mocks.construct.mockImplementation(() => {
			throw WEBGL_PROGRAM_ERROR;
		});
		const { parent, canvas } = parentWithCanvas();
		expect(tryCreateShaderMount(parent, { u_size: 0.12 })).toBeNull();
		expect(canvas.removed).toBe(true);
	});

	it('swallows missing-WebGL constructor errors', () => {
		mocks.construct.mockImplementation(() => {
			throw new Error('Paper Shaders: WebGL is not supported in this browser');
		});
		const { parent } = parentWithCanvas();
		expect(tryCreateShaderMount(parent, { u_size: 0.12 })).toBeNull();
	});
});

describe('discardFailedShaderCanvas', () => {
	it('only removes a direct child canvas', () => {
		const { parent, canvas } = parentWithCanvas();
		discardFailedShaderCanvas(parent);
		expect(canvas.removed).toBe(true);
	});
});
