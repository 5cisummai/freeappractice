import { describe, expect, it } from 'vitest';
import { bugReportSchema } from '$lib/schemas/bug-report';

const validReport = {
	title: 'Broken submit button',
	description: 'Clicking submit does nothing on the practice page.',
	severity: 'high' as const,
	email: 'student@example.com'
};

describe('bugReportSchema', () => {
	it('accepts a valid report and defaults severity', () => {
		const parsed = bugReportSchema.parse({
			title: validReport.title,
			description: validReport.description
		});
		expect(parsed.severity).toBe('medium');
		expect(parsed.email).toBeUndefined();
	});

	it('rejects short titles and descriptions', () => {
		expect(() => bugReportSchema.parse({ ...validReport, title: 'Hey' })).toThrow();
		expect(() => bugReportSchema.parse({ ...validReport, description: 'Too short' })).toThrow();
	});

	it('rejects invalid emails and unknown severities', () => {
		expect(() => bugReportSchema.parse({ ...validReport, email: 'nope' })).toThrow();
		expect(() => bugReportSchema.parse({ ...validReport, severity: 'critical' })).toThrow();
	});

	it('rejects metadata with too many keys', () => {
		const metadata = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`k${i}`, i]));
		expect(() => bugReportSchema.parse({ ...validReport, metadata })).toThrow(/at most 20 keys/);
	});

	it('rejects oversized metadata payloads', () => {
		const metadata = { blob: 'x'.repeat(8_001) };
		expect(() => bugReportSchema.parse({ ...validReport, metadata })).toThrow(/too large/);
	});

	it('trims optional blank strings to undefined', () => {
		const parsed = bugReportSchema.parse({
			...validReport,
			steps: '   ',
			expected: '  something  '
		});
		expect(parsed.steps).toBeUndefined();
		expect(parsed.expected).toBe('something');
	});
});
