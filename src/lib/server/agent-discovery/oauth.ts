import { absoluteUrl } from './site';

export function buildOAuthAuthorizationServerMetadata(requestUrl?: URL) {
	const issuer = absoluteUrl('/', requestUrl);

	return {
		issuer,
		authorization_endpoint: absoluteUrl('/api/auth/sign-in/social/google', requestUrl),
		token_endpoint: absoluteUrl('/api/auth/get-session', requestUrl),
		jwks_uri: absoluteUrl('/api/auth/jwks', requestUrl),
		registration_endpoint: absoluteUrl('/api/auth/sign-up/email', requestUrl),
		scopes_supported: ['openid', 'profile', 'email', 'offline_access'],
		response_types_supported: ['code'],
		grant_types_supported: ['authorization_code', 'refresh_token'],
		token_endpoint_auth_methods_supported: ['client_secret_post', 'none'],
		code_challenge_methods_supported: ['S256'],
		agent_auth: {
			skill: absoluteUrl('/auth.md', requestUrl),
			register_uri: absoluteUrl('/api/auth/sign-up/email', requestUrl),
			identity_types_supported: ['anonymous', 'verified_email'],
			anonymous: {
				credential_types_supported: ['session_cookie'],
				claim_uri: absoluteUrl('/signup', requestUrl)
			},
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
		scopes_supported: ['profile', 'email', 'offline_access'],
		bearer_methods_supported: ['header', 'cookie'],
		resource_documentation: absoluteUrl('/llms.txt', requestUrl)
	};
}
