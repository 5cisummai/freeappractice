import { beforeEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({
	AI_GATEWAY_API_KEY: undefined as string | undefined,
	VERCEL_OIDC_TOKEN: undefined as string | undefined,
	AI_GATEWAY_BASE_URL: undefined as string | undefined
}));

vi.mock('$env/dynamic/private', () => ({ env }));

import {
	AI_GATEWAY_BASE_URL,
	gatewayModel,
	isGatewayCredentialConfigured,
	requireGatewayCredential
} from '$lib/ai/gateway.server';
import {
	COACH_MODEL,
	MCQ_GENERATION_MODEL,
	MEM0_EMBEDDING_MODEL,
	SIM_MODEL
} from '$lib/ai/ai-models-config';

describe('AI Gateway wiring', () => {
	beforeEach(() => {
		env.AI_GATEWAY_API_KEY = undefined;
		env.VERCEL_OIDC_TOKEN = undefined;
		env.AI_GATEWAY_BASE_URL = undefined;
	});

	it('uses provider/model slugs from the model config', () => {
		expect(MCQ_GENERATION_MODEL).toBe('openai/gpt-6-luna');
		expect(COACH_MODEL).toBe('openai/gpt-6-luna');
		expect(SIM_MODEL).toBe('openai/gpt-6.1-sol');
		expect(MEM0_EMBEDDING_MODEL).toBe('openai/text-embedding-3-small');
		expect(AI_GATEWAY_BASE_URL).toBe('https://ai-gateway.vercel.sh/v1');
	});

	it('requires a Gateway API key or OIDC token', () => {
		expect(isGatewayCredentialConfigured()).toBe(false);
		expect(() => requireGatewayCredential()).toThrow(/AI_GATEWAY_API_KEY/);
		env.AI_GATEWAY_API_KEY = 'test-key';
		expect(isGatewayCredentialConfigured()).toBe(true);
		expect(requireGatewayCredential()).toBe('test-key');
		expect(gatewayModel(COACH_MODEL)).toBe('openai/gpt-6-luna');
	});

	it('accepts VERCEL_OIDC_TOKEN when no API key is set', () => {
		env.VERCEL_OIDC_TOKEN = 'oidc-token';
		expect(requireGatewayCredential()).toBe('oidc-token');
	});
});
