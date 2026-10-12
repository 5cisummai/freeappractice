import { env } from '$env/dynamic/private';

/** OpenAI-compatible AI Gateway base URL (chat, responses, embeddings, batches, files). */
export const AI_GATEWAY_BASE_URL = 'https://ai-gateway.vercel.sh/v1';

/** Bearer credential for AI Gateway (API key locally/CI; OIDC on Vercel). */
export function requireGatewayCredential(): string {
	const key = env.AI_GATEWAY_API_KEY?.trim() || env.VERCEL_OIDC_TOKEN?.trim();
	if (!key) {
		throw new Error('AI_GATEWAY_API_KEY (or VERCEL_OIDC_TOKEN) is not set');
	}
	return key;
}

export function isGatewayCredentialConfigured(): boolean {
	return Boolean(env.AI_GATEWAY_API_KEY?.trim() || env.VERCEL_OIDC_TOKEN?.trim());
}
