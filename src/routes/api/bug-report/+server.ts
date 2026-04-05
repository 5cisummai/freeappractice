import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { GITHUB_BUG_REPORT_TOKEN } from '$env/static/private';
import { logger } from '$lib/server/logger';

const GITHUB_OWNER = '5cisummai';
const GITHUB_REPO = 'freeappractice';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const recentReportByIp = new Map<string, number>();

const reportSchema = z.object({
	title: z.string().min(5),
	description: z.string().min(10),
	steps: z.string().optional(),
	expected: z.string().optional(),
	severity: z.enum(['low', 'medium', 'high']).default('low'),
	email: z.string().email().optional(),
	metadata: z.record(z.string(), z.unknown()).optional()
});

const SEVERITY_LABEL: Record<string, string> = {
	low: 'severity: low',
	medium: 'severity: medium',
	high: 'severity: high'
};

function buildIssueBody(parsed: z.infer<typeof reportSchema>): string {
	const lines: string[] = [];

	lines.push(`## Description\n${parsed.description}`);

	if (parsed.steps?.trim()) {
		lines.push(`## Steps to Reproduce\n${parsed.steps}`);
	}

	if (parsed.expected?.trim()) {
		lines.push(`## Expected Behavior\n${parsed.expected}`);
	}

	if (parsed.email?.trim()) {
		lines.push(`## Reporter\n${parsed.email}`);
	}

	if (parsed.metadata && Object.keys(parsed.metadata).length > 0) {
		const meta = Object.entries(parsed.metadata)
			.map(([k, v]) => `- **${k}**: ${JSON.stringify(v)}`)
			.join('\n');
		lines.push(`## Context\n${meta}`);
	}

	lines.push(`---\n*Submitted via bug report form on freeappractice.org*`);

	return lines.join('\n\n');
}

function getRetryAfterMs(ip: string, now: number): number {
	const lastSubmittedAt = recentReportByIp.get(ip);
	if (!lastSubmittedAt) {
		return 0;
	}

	return Math.max(0, RATE_LIMIT_WINDOW_MS - (now - lastSubmittedAt));
}

function pruneExpiredRateLimits(now: number) {
	for (const [ip, lastSubmittedAt] of recentReportByIp.entries()) {
		if (now - lastSubmittedAt >= RATE_LIMIT_WINDOW_MS) {
			recentReportByIp.delete(ip);
		}
	}
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	try {
		const now = Date.now();
		pruneExpiredRateLimits(now);

		const clientIp = getClientAddress();
		const retryAfterMs = getRetryAfterMs(clientIp, now);
		if (retryAfterMs > 0) {
			const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
			return json(
				{
					error: 'Too many bug reports. Please wait a few minutes before submitting another one.',
					retryAfterSeconds
				},
				{
					status: 429,
					headers: {
						'RateLimit-Limit': '1',
						'RateLimit-Remaining': '0',
						'RateLimit-Reset': String(Math.ceil((now + retryAfterMs) / 1000)),
						'Retry-After': String(retryAfterSeconds)
					}
				}
			);
		}

		const body = await request.json();
		const parsed = reportSchema.parse(body);

		const issuePayload = {
			title: `[Bug] ${parsed.title}`,
			body: buildIssueBody(parsed),
			labels: ['bug', SEVERITY_LABEL[parsed.severity]]
		};

		const response = await fetch(GITHUB_API_URL, {
			method: 'POST',
			headers: {
				Accept: 'application/vnd.github+json',
				Authorization: `Bearer ${GITHUB_BUG_REPORT_TOKEN}`,
				'X-GitHub-Api-Version': '2022-11-28',
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(issuePayload)
		});

		if (!response.ok) {
			const errorText = await response.text();
			logger.error('GitHub Issues API error', { status: response.status, body: errorText });
			return json({ error: 'Failed to submit bug report' }, { status: 500 });
		}

		const issue = (await response.json()) as { number: number; html_url: string };
		recentReportByIp.set(clientIp, now);

		logger.info('Bug report submitted as GitHub issue', {
			issue: issue.number,
			url: issue.html_url,
			severity: parsed.severity,
			title: parsed.title
		});

		return json({ ok: true, id: `GH-${issue.number}` }, { status: 201 });
	} catch (err) {
		if (err instanceof z.ZodError) {
			return json({ error: 'Validation failed', details: err.issues }, { status: 400 });
		}
		logger.error('Bug report error', { error: err });
		return json({ error: 'Failed to submit bug report' }, { status: 500 });
	}
};
