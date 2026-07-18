import { z } from 'zod';

const optionalTrimmedString = (max: number) =>
	z.preprocess((value) => {
		if (typeof value !== 'string') return value;
		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : undefined;
	}, z.string().max(max).optional());

const BUG_REPORT_SEVERITIES = ['low', 'medium', 'high'] as const;

export const bugReportSchema = z.object({
	title: z.string().trim().min(5, 'Use at least 5 characters.').max(120),
	description: z.string().trim().min(10, 'Use at least 10 characters.').max(5000),
	steps: optionalTrimmedString(5000),
	expected: optionalTrimmedString(2000),
	severity: z.enum(BUG_REPORT_SEVERITIES).default('medium'),
	email: optionalTrimmedString(254).pipe(z.string().email('Enter a valid email.').optional()),
	metadata: z
		.record(z.string().trim().min(1).max(80), z.unknown())
		.optional()
		.superRefine((metadata, ctx) => {
			if (!metadata) return;
			const keys = Object.keys(metadata);
			if (keys.length > 20) {
				ctx.addIssue({
					code: 'custom',
					message: 'metadata may include at most 20 keys'
				});
			}
			const serialized = JSON.stringify(metadata);
			if (serialized.length > 8_000) {
				ctx.addIssue({
					code: 'custom',
					message: 'metadata payload is too large'
				});
			}
		})
});

export type BugReportPayload = z.infer<typeof bugReportSchema>;
export type BugReportSeverity = BugReportPayload['severity'];
