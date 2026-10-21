import { beforeEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({
	AI_GATEWAY_API_KEY: undefined as string | undefined,
	VERCEL_OIDC_TOKEN: undefined as string | undefined,
	AI_GATEWAY_BASE_URL: undefined as string | undefined
}));

vi.mock('$app/env/private', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	get AI_GATEWAY_API_KEY() {
		return env.AI_GATEWAY_API_KEY;
	},
	get VERCEL_OIDC_TOKEN() {
		return env.VERCEL_OIDC_TOKEN;
	},
	get AI_GATEWAY_BASE_URL() {
		return env.AI_GATEWAY_BASE_URL;
	}
}));

import {
	isGatewayCredentialConfigured,
	requireGatewayCredential
} from '#lib/server/gateway-credentials.server.js';

describe('AI Gateway wiring', () => {
	beforeEach(() => {
		env.AI_GATEWAY_API_KEY = undefined;
		env.VERCEL_OIDC_TOKEN = undefined;
		env.AI_GATEWAY_BASE_URL = undefined;
	});

	it('requires a Gateway API key or OIDC token', () => {
		expect(isGatewayCredentialConfigured()).toBe(false);
		expect(() => requireGatewayCredential()).toThrow(/AI_GATEWAY_API_KEY/);
		env.AI_GATEWAY_API_KEY = 'test-key';
		expect(isGatewayCredentialConfigured()).toBe(true);
		expect(requireGatewayCredential()).toBe('test-key');
	});

	it('accepts VERCEL_OIDC_TOKEN when no API key is set', () => {
		env.VERCEL_OIDC_TOKEN = 'oidc-token';
		expect(requireGatewayCredential()).toBe('oidc-token');
	});
});
