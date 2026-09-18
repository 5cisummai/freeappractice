import { authClient } from '$lib/auth/client.js';
import { authCallbackUrl } from '$lib/auth/urls.js';
import { EMAIL_SEND_FAILED_MESSAGE } from '$lib/auth/resend-result';
import { EMAIL_DELIVERY_HEADER } from '$lib/auth/email-delivery';

export type VerificationEmailRequestResult = {
	deliveryId: string;
	error: string | null;
};

/** Request a verification email and return the ID used by the Resend webhook flow. */
export async function requestVerificationEmail(
	email: string
): Promise<VerificationEmailRequestResult> {
	const deliveryId = crypto.randomUUID();

	try {
		const { error } = await authClient.sendVerificationEmail(
			{
				email,
				callbackURL: authCallbackUrl('/app')
			},
			{
				headers: { [EMAIL_DELIVERY_HEADER]: deliveryId }
			}
		);
		return { deliveryId, error: error?.message ?? null };
	} catch {
		return { deliveryId, error: EMAIL_SEND_FAILED_MESSAGE };
	}
}
