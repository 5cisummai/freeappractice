export const AGE_ATTESTATION_COOKIE = 'fap_age_attestation';
const AGE_ATTESTATION_MAX_AGE_SECONDS = 10 * 60;

export function persistAgeAttestation(attested: boolean): void {
	if (typeof document === 'undefined') return;

	const secure = window.location.protocol === 'https:' ? '; Secure' : '';
	if (attested) {
		document.cookie = `${AGE_ATTESTATION_COOKIE}=1; path=/; max-age=${AGE_ATTESTATION_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
	} else {
		document.cookie = `${AGE_ATTESTATION_COOKIE}=; path=/; max-age=0; SameSite=Lax${secure}`;
	}
}

export function hasAgeAttestationCookie(cookieHeader: string | null): boolean {
	return (cookieHeader ?? '')
		.split(';')
		.some((cookie) => cookie.trim() === `${AGE_ATTESTATION_COOKIE}=1`);
}
