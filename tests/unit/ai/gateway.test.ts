import { beforeEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({
	AI_GATEWAY_API_KEY: undefined as string | undefined,
	VERCEL_OIDC_TOKEN: undefined as string | undefined,
	AI_GATEWAY_BASE_URL: undefined as string | undefined
}));

vi.mock('$env/dynamic/private', () => ({ env }));

import { AI_GATEWAY_BASE_URL, isGatewayCredentialConfigured, requireGatewayCredential } from '$lib/server/gateway-credentials.server';
import { COACH_MODEL } from '$lib/agent/model';
import { MCQ_GENERATION_MODEL } from '$lib/question-bank/mcq/generation.server';
import { MEM0_EMBEDDING_MODEL } from '$lib/agent/memory/service.server';
import { SIM_MODEL } from '$lib/agent/tools/simulation.server';

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
		expect(COACH_MODEL).toBe('openai/gpt-6-luna');
	});

	it('accepts VERCEL_OIDC_TOKEN when no API key is set', () => {
		env.VERCEL_OIDC_TOKEN = 'oidc-token';
		expect(requireGatewayCredential()).toBe('oidc-token');
	});
});
