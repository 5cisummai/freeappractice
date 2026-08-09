/** Format a YYYY-MM-DD value as a local calendar date without a UTC timezone shift. */
export function formatDateOnly(
	value: string,
	locales?: Intl.LocalesArgument,
	options?: Intl.DateTimeFormatOptions
): string {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) return value;

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const date = new Date(year, month - 1, day, 12);
	if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
		return value;
	}

	return date.toLocaleDateString(locales, options);
}
