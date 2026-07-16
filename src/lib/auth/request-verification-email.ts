import { authClient } from '$lib/auth/client.js';
import { authCallbackUrl } from '$lib/auth/urls.js';
import { EMAIL_SEND_FAILED_MESSAGE } from '$lib/auth/resend-result';

/** Request a verification email via Better Auth's awaited endpoint (errors propagate). */
export async function requestVerificationEmail(email: string): Promise<string | null> {
	try {
		const { error } = await authClient.sendVerificationEmail({
			email,
			callbackURL: authCallbackUrl('/app')
		});
		if (error) return error.message ?? EMAIL_SEND_FAILED_MESSAGE;
		return null;
	} catch {
		return EMAIL_SEND_FAILED_MESSAGE;
	}
}
