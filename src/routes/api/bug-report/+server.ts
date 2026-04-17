import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { GITHUB_BUG_REPORT_TOKEN } from '$env/static/private';
import { logger } from '$lib/server/logger';

const GITHUB_OWNER = '5cisummai';
const GITHUB_REPO = 'freeappractice';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const recentReportByIp = new Map<string, number>();

const reportSchema = z.object({
	title: z.string().min(5).max(200),
	description: z.string().min(10).max(5000),
	steps: z.string().max(5000).optional(),
	expected: z.string().max(2000).optional(),
	severity: z.enum(['low', 'medium', 'high']).default('low'),
	email: z.string().email().max(254).optional(),
	metadata: z.record(z.string(), z.unknown()).optional()
});

const SEVERITY_LABEL: Record<string, string> = {
	low: 'severity: low',
	medium: 'severity: medium',
	high: 'severity: high'
};

function escapeMarkdown(text: string): string {
	return text.replace(/`/g, '\\`').replace(/\[/g, '\\[').replace(/</g, '&lt;');
}

function buildIssueBody(parsed: z.infer<typeof reportSchema>): string {
	const lines: string[] = [];

	lines.push(`## Description\n${escapeMarkdown(parsed.description)}`);

	if (parsed.steps?.trim()) {
		lines.push(`## Steps to Reproduce\n${escapeMarkdown(parsed.steps)}`);
	}

	if (parsed.expected?.trim()) {
		lines.push(`## Expected Behavior\n${escapeMarkdown(parsed.expected)}`);
	}

	if (parsed.email?.trim()) {
		lines.push(`## Reporter\n${escapeMarkdown(parsed.email)}`);
	}

	if (parsed.metadata && Object.keys(parsed.metadata).length > 0) {
		const meta = Object.entries(parsed.metadata)
			.map(([k, v]) => `- **${k}**: ${escapeMarkdown(JSON.stringify(v))}`)
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

		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return json({ error: 'Invalid request body' }, { status: 400 });
		}

		const result = reportSchema.safeParse(body);
		if (!result.success) {
			return json({ error: 'Validation failed', details: result.error.flatten() }, { status: 400 });
		}
		const parsed = result.data;

		const issuePayload = {
			title: `[Bug] ${escapeMarkdown(parsed.title)}`,
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
		logger.error('Bug report error', { error: err });
		return json({ error: 'Failed to submit bug report' }, { status: 500 });
	}
};
