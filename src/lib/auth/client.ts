import { PUBLIC_GOOGLE_CLIENT_ID } from '$env/static/public';
import { createAuthClient } from 'better-auth/client';
import {
	adminClient,
	inferOrgAdditionalFields,
	organizationClient
} from 'better-auth/client/plugins';
import { stripeClient } from '@better-auth/stripe/client';

export const googleClientId = PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? '';

export const authClient = createAuthClient({
	plugins: [
		adminClient(),
		organizationClient({
			schema: inferOrgAdditionalFields({
				organization: {
					additionalFields: {
						orgType: { type: 'string' },
						shareToken: { type: 'string', required: false }
					}
				}
			})
		}),
		stripeClient({ subscription: true })
	]
});
