/** Shape of Resend's emails.send() result (success or error). */
export type ResendSendResult = {
	data: { id: string } | null;
	error: { message: string; statusCode: number | null; name: string } | null;
};

/**
 * Resend returns `{ data, error }` instead of throwing on API failures.
 * Throw so callers (and Better Auth's awaited sendVerificationEmail path) can surface errors.
 */
export function assertResendSent(result: ResendSendResult): void {
	if (result.error) {
		throw new Error(result.error.message || 'Failed to send email');
	}
	if (!result.data?.id) {
		throw new Error('Failed to send email');
	}
}

export const EMAIL_SEND_FAILED_MESSAGE =
	"We couldn't send the email. Please try again in a moment.";
