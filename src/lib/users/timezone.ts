/** Cookie storing the browser IANA timezone for streak day boundaries. */
export const TIMEZONE_COOKIE_NAME = 'user_timezone';
export const TIMEZONE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Return a validated IANA timezone, or undefined when missing/invalid. */
export function parseTimezone(value: string | null | undefined): string | undefined {
	if (!value) return undefined;
	let decoded = value.trim();
	try {
		decoded = decodeURIComponent(decoded);
	} catch {
		return undefined;
	}
	const trimmed = decoded.trim();
	if (!trimmed || trimmed.length > 64) return undefined;
	try {
		Intl.DateTimeFormat(undefined, { timeZone: trimmed });
		return trimmed;
	} catch {
		return undefined;
	}
}

export function timezoneFromCookies(cookies: {
	get: (name: string) => string | undefined;
}): string | undefined {
	return parseTimezone(cookies.get(TIMEZONE_COOKIE_NAME));
}
