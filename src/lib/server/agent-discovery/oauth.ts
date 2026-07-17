import { absoluteUrl } from './site';

/**
 * Auth discovery for agents. This is not a standards-compliant OAuth2 AS —
 * Free AP Practice uses Better Auth (session cookies + email/social sign-in).
 * Endpoints below point at real Better Auth / site routes only.
 */
export function buildOAuthAuthorizationServerMetadata(requestUrl?: URL) {
	const issuer = absoluteUrl('/', requestUrl);

	return {
		issuer,
		authorization_endpoint: absoluteUrl('/login', requestUrl),
		registration_endpoint: absoluteUrl('/signup', requestUrl),
		scopes_supported: ['profile', 'email'],
		response_types_supported: ['code'],
		grant_types_supported: [] as string[],
		token_endpoint_auth_methods_supported: ['none'],
		service_documentation: absoluteUrl('/auth.md', requestUrl),
		agent_auth: {
			skill: absoluteUrl('/auth.md', requestUrl),
			register_uri: absoluteUrl('/api/auth/sign-up/email', requestUrl),
			identity_types_supported: ['verified_email'],
			identity_assertion: {
				assertion_types_supported: ['verified_email'],
				credential_types_supported: ['session_cookie'],
				claim_uri: absoluteUrl('/verify-email', requestUrl)
			}
		}
	};
}

export function buildOAuthProtectedResourceMetadata(requestUrl?: URL) {
	const resource = absoluteUrl('/api', requestUrl);
	const issuer = absoluteUrl('/', requestUrl);

	return {
		resource,
		authorization_servers: [issuer],
		scopes_supported: ['profile', 'email'],
		bearer_methods_supported: ['cookie'],
		resource_documentation: absoluteUrl('/llms.txt', requestUrl)
	};
}
