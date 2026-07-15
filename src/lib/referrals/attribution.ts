export type ReferralAttribution = {
	code: string;
	capturedAt: number;
};

export function normalizeReferralCode(code: string): string {
	return code.trim();
}

export function isValidReferralCodeShape(code: string): boolean {
	const normalized = normalizeReferralCode(code);
	return normalized.length > 0 && normalized.length <= 64;
}

export function parseReferralAttribution(raw: string): ReferralAttribution | null {
	try {
		const parsed = JSON.parse(raw) as ReferralAttribution;
		if (
			typeof parsed.code !== 'string' ||
			typeof parsed.capturedAt !== 'number' ||
			!Number.isFinite(parsed.capturedAt) ||
			!isValidReferralCodeShape(parsed.code)
		) {
			return null;
		}
		return { code: normalizeReferralCode(parsed.code), capturedAt: parsed.capturedAt };
	} catch {
		return null;
	}
}

/** New accounts only: profile must be created at/after the invite was captured. */
export function canAttributeReferral(opts: {
	referrerUserId: string;
	referredUserId: string;
	profileCreatedAtMs: number;
	capturedAtMs: number;
}): boolean {
	if (!opts.referrerUserId || !opts.referredUserId) return false;
	if (opts.referrerUserId === opts.referredUserId) return false;
	return opts.profileCreatedAtMs >= opts.capturedAtMs;
}

/** If the referred student already practiced before claim ran, activate immediately. */
export function shouldActivateOnClaim(attemptCount: number): boolean {
	return Number.isFinite(attemptCount) && attemptCount > 0;
}
