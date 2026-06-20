import { PUBLIC_GOOGLE_CLIENT_ID } from '$env/static/public';
import { createAuthClient } from 'better-auth/client';
import { oneTapClient } from 'better-auth/client/plugins';

export const googleClientId = PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? '';

export const googleOneTapEnabled = Boolean(googleClientId);

export const authClient = createAuthClient({
	plugins: googleClientId
		? [
				oneTapClient({
					clientId: googleClientId,
					cancelOnTapOutside: true,
					promptOptions: {
						baseDelay: 1000,
						maxAttempts: 5
					}
				})
			]
		: []
});
