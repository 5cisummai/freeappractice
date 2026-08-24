/** Format a calendar day as YYYY-MM-DD in a timezone, or the runtime local zone. */
export function formatDayInTimeZone(date: Date, timeZone?: string): string {
	if (!timeZone) {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(date);
	const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
	const month = parts.find((part) => part.type === 'month')?.value ?? '01';
	const day = parts.find((part) => part.type === 'day')?.value ?? '01';
	return `${year}-${month}-${day}`;
}

/** UTC calendar day. Date-only ISO strings keep their written day instead of shifting. */
export function utcDateKey(value: Date | string): string {
	if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
	const date = value instanceof Date ? value : new Date(value);
	return date.toISOString().slice(0, 10);
}
