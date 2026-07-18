import { absoluteUrl } from './site';

export function buildAuthMd(requestUrl?: URL): string {
	const signup = absoluteUrl('/signup', requestUrl);
	const signUpApi = absoluteUrl('/api/auth/sign-up/email', requestUrl);
	const signInApi = absoluteUrl('/api/auth/sign-in/email', requestUrl);
	const prm = absoluteUrl('/.well-known/oauth-protected-resource', requestUrl);
	const oauthAs = absoluteUrl('/.well-known/oauth-authorization-server', requestUrl);

	return `# auth.md — Free AP Practice

Free AP Practice helps high school students generate unlimited AP exam practice questions with instant feedback.

## Audience

AI agents assisting students with AP course planning, summer study, and exam preparation.

## Protected resources

- API base: \`${absoluteUrl('/api', requestUrl)}\`
- OAuth Protected Resource Metadata: \`${prm}\`

## Registration

Agents may create accounts on behalf of users using email and password:

- **Web sign-up:** ${signup}
- **API sign-up:** \`POST ${signUpApi}\` with JSON \`{ "email", "password", "name" }\`
- **API sign-in:** \`POST ${signInApi}\` with JSON \`{ "email", "password" }\`

After sign-in, session cookies authenticate subsequent API requests. Email verification is required before full access.

## Supported identity flows

### Anonymous (session cookie)

Users can practice without an account. Progress is stored locally in the browser.

- Credential: browser session / local storage
- Claim URL: ${signup}

### Verified email

Email/password registration with verification link sent to the user.

- Assertion type: \`verified_email\`
- Claim URL: ${absoluteUrl('/verify-email', requestUrl)}

## Auth discovery

- Auth skill document: \`${oauthAs}\` (Better Auth session cookies — not a full OAuth2 authorization server)
- Google social sign-in: \`${absoluteUrl('/api/auth/sign-in/social/google', requestUrl)}\`

## Scopes

- \`profile\` — user profile fields
- \`email\` — verified email address

## Contact

- Support: support@freeappractice.org
- Security: security@freeappractice.org
`;
}
