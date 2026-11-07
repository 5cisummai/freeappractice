import { describe, expect, it } from 'vitest';
import { variables } from '../../../src/env.ts';
import {
	desmosCalculatorScriptUrl,
	desmosErrorHint,
	desmosSandboxError,
	desmosUserMessage,
	parseDesmosSandboxMessage,
	resolveDesmosApiKey
} from '#lib/desmos/config.js';

describe('PUBLIC_DESMOS_API_KEY env wiring', () => {
	it('stays public and runtime so Vercel can supply it after build', () => {
		expect(variables.PUBLIC_DESMOS_API_KEY.public).toBe(true);
		expect(variables.PUBLIC_DESMOS_API_KEY).not.toHaveProperty('static');
	});
});

describe('resolveDesmosApiKey', () => {
	it.each([
		{ value: undefined, expected: null },
		{ value: '', expected: null },
		{ value: '   ', expected: null },
		{ value: 'abc123', expected: 'abc123' },
		{ value: '  abc123  ', expected: 'abc123' }
	])('resolves $value', ({ value, expected }) => {
		expect(resolveDesmosApiKey(value)).toBe(expected);
	});
});

describe('desmos calculator errors', () => {
	it('keeps configuration failures distinct from network failures', () => {
		expect(desmosUserMessage('missing_api_key')).toBe('The calculator is temporarily unavailable.');
		expect(desmosErrorHint('missing_api_key')).toBeNull();
		expect(desmosSandboxError('missing_api_key')).toEqual({
			type: 'error',
			code: 'missing_api_key',
			message: 'The calculator is temporarily unavailable.'
		});
		expect(desmosUserMessage('script_load')).toBe('Could not load the calculator.');
		expect(desmosErrorHint('script_load')).toBe('Check your network connection and try again.');
		expect(desmosUserMessage('init')).toBe('Could not start the calculator.');
		expect(desmosErrorHint('init')).toBe('Check your network connection and try again.');
	});

	it('does not leak env-file instructions in student-facing copy', () => {
		for (const code of ['missing_api_key', 'script_load', 'init'] as const) {
			expect(desmosUserMessage(code)).not.toMatch(/PUBLIC_DESMOS_API_KEY|\.env/i);
			expect(desmosErrorHint(code) ?? '').not.toMatch(/PUBLIC_DESMOS_API_KEY|\.env/i);
		}
	});

	it('builds the Desmos script URL without treating the key as a fallback demo value', () => {
		expect(desmosCalculatorScriptUrl('test-key')).toBe(
			'https://www.desmos.com/api/v1.12/calculator.js?apiKey=test-key'
		);
		expect(desmosCalculatorScriptUrl('a+b')).toContain('apiKey=a%2Bb');
	});
});

describe('parseDesmosSandboxMessage', () => {
	it('accepts ready and typed error payloads', () => {
		expect(parseDesmosSandboxMessage({ type: 'ready' })).toEqual({ type: 'ready' });
		expect(parseDesmosSandboxMessage({ type: 'error', code: 'missing_api_key' })).toEqual({
			type: 'error',
			code: 'missing_api_key',
			message: 'The calculator is temporarily unavailable.'
		});
		expect(
			parseDesmosSandboxMessage({
				type: 'error',
				code: 'script_load',
				message: 'Could not load the calculator.'
			})
		).toEqual({
			type: 'error',
			code: 'script_load',
			message: 'Could not load the calculator.'
		});
	});

	it('ignores unrelated postMessage payloads', () => {
		expect(parseDesmosSandboxMessage(null)).toBeNull();
		expect(parseDesmosSandboxMessage({ type: 'init', calcType: 'graphing' })).toBeNull();
		expect(parseDesmosSandboxMessage('ready')).toBeNull();
	});

	it('falls back unknown error codes to init without using network copy for config', () => {
		expect(parseDesmosSandboxMessage({ type: 'error' })).toEqual({
			type: 'error',
			code: 'init',
			message: 'Could not start the calculator.'
		});
		expect(desmosErrorHint('missing_api_key')).toBeNull();
	});
});
