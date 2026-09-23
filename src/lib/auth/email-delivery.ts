export const EMAIL_DELIVERY_HEADER = 'x-email-delivery-id';
export const EMAIL_DELIVERY_TAG = 'delivery_id';

export type EmailDeliveryType =
	| 'verification'
	| 'password_reset'
	| 'email_change'
	| 'account_deletion'
	| 'existing_signup'
	| 'organization_invitation';

export type EmailDeliveryStatus = 'pending' | 'sent' | 'failed';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isEmailDeliveryId(value: string | null | undefined): value is string {
	return value !== undefined && value !== null && UUID_PATTERN.test(value);
}

export function getEmailDeliveryFailureMessage(type: EmailDeliveryType): string {
	switch (type) {
		case 'password_reset':
			return "We couldn't send your password reset email. Please try again in a moment.";
		case 'email_change':
			return "We couldn't send the email change confirmation. Please try again in a moment.";
		case 'account_deletion':
			return "We couldn't send the account deletion confirmation. Please try again in a moment.";
		case 'existing_signup':
			return "We couldn't send the sign-up notice. Please try again in a moment.";
		case 'organization_invitation':
			return "We couldn't send the organization invitation. Please try again in a moment.";
		case 'verification':
		default:
			return "We couldn't send your verification email. Please try again in a moment.";
	}
}

export function getEmailDeliverySuccessMessage(type: EmailDeliveryType): string {
	switch (type) {
		case 'password_reset':
			return 'Password reset email sent. Check your inbox.';
		case 'email_change':
			return 'Email change confirmation sent. Check your inbox.';
		case 'account_deletion':
			return 'Account deletion confirmation sent. Check your inbox.';
		case 'existing_signup':
			return 'Sign-up notice sent. Check your inbox.';
		case 'organization_invitation':
			return 'Organization invitation sent. Check your inbox.';
		case 'verification':
		default:
			return 'Verification email sent. Check your inbox.';
	}
}
