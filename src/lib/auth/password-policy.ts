export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 72;
export const MAX_PASSWORD_BYTES = 72;

export const PASSWORD_LENGTH_HINT = `Must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_BYTES} characters.`;
export const PASSWORD_LENGTH_ERROR = `Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_BYTES} characters.`;

function passwordByteLength(password: string): number {
	return new TextEncoder().encode(password).byteLength;
}

export function isPasswordWithinLimit(password: string): boolean {
	return (
		password.length <= MAX_PASSWORD_LENGTH && passwordByteLength(password) <= MAX_PASSWORD_BYTES
	);
}
