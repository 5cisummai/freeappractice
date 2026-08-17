export const MINIMUM_ACCOUNT_AGE = 13;
export const EARLIEST_BIRTH_DATE = '1900-01-01';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(value: number): string {
	return String(value).padStart(2, '0');
}

function isLeapYear(year: number): boolean {
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
	if (month === 2) return isLeapYear(year) ? 29 : 28;
	if (month === 4 || month === 6 || month === 9 || month === 11) return 30;
	return 31;
}

function parseYmd(value: string): [number, number, number] | null {
	const match = DATE_PATTERN.exec(value);
	if (!match) return null;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
	return [year, month, day];
}

export function formatDateInput(year: number, month: number, day: number): string {
	return `${year}-${pad(month)}-${pad(day)}`;
}

export function localDateInputValue(date = new Date()): string {
	return formatDateInput(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function utcDateInputValue(date = new Date()): string {
	return date.toISOString().slice(0, 10);
}

function addDaysToDateInput(value: string, days: number): string | null {
	const parts = parseYmd(value);
	if (!parts) return null;
	const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
	date.setUTCDate(date.getUTCDate() + days);
	return formatDateInput(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function defaultBirthDateToday(): string {
	return addDaysToDateInput(utcDateInputValue(), 1) ?? utcDateInputValue();
}

export function addYearsToDateInput(value: string, years: number): string | null {
	const parts = parseYmd(value);
	if (!parts) return null;
	const [year, month, day] = parts;
	const nextYear = year + years;
	const nextDay = month === 2 && day === 29 && !isLeapYear(nextYear) ? 28 : day;
	return formatDateInput(nextYear, month, nextDay);
}

export function isValidBirthDate(value: string, today = defaultBirthDateToday()): boolean {
	if (!parseYmd(value)) return false;
	return value >= EARLIEST_BIRTH_DATE && value <= today;
}

export function isAtLeastAge(
	value: string,
	age = MINIMUM_ACCOUNT_AGE,
	today = defaultBirthDateToday()
): boolean {
	if (!isValidBirthDate(value, today)) return false;
	const birthday = addYearsToDateInput(value, age);
	return birthday !== null && today >= birthday;
}

export function earliestBirthDateForInput(today = localDateInputValue()): string {
	return addYearsToDateInput(today, -120) ?? EARLIEST_BIRTH_DATE;
}

export class InvalidBirthDateError extends Error {
	constructor(message = 'Enter a valid birth date.') {
		super(message);
		this.name = 'InvalidBirthDateError';
	}
}

export class UnderAgeError extends Error {
	constructor(message = `You must be at least ${MINIMUM_ACCOUNT_AGE} to use Free AP Practice.`) {
		super(message);
		this.name = 'UnderAgeError';
	}
}
