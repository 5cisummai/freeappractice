import { json } from '@sveltejs/kit';
import { GITHUB_BUG_REPORT_TOKEN } from '$env/static/private';
import { limitBugReports } from '$lib/bug-report/rate-limit.server';
import { bugReportSchema, type BugReportPayload } from '$lib/schemas/bug-report';
import { logger } from '$lib/server/logger';

const GITHUB_OWNER = '5cisummai';
const GITHUB_REPO = 'freeappractice';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`;
const SEVERITY_LABEL: Record<string, string> = {
	low: 'severity: low',
	medium: 'severity: medium',
	high: 'severity: high'
};

function escapeMarkdown(text: string): string {
	return text
		.replace(/\\/g, '\\\\')
		.replace(/`/g, '\\`')
		.replace(/\[/g, '\\[')
		.replace(/</g, '&lt;')
		.replace(/\r?\n/g, ' ')
		.trim();
}

function buildIssueBody(parsed: BugReportPayload): string {
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
			.map(([k, v]) => `- **${escapeMarkdown(k)}**: ${escapeMarkdown(JSON.stringify(v))}`)
			.join('\n');
		lines.push(`## Context\n${meta}`);
	}

	lines.push(`---\n*Submitted via bug report form on freeappractice.org*`);

	return lines.join('\n\n');
}

export async function submitBugReport(request: Request, clientIp: string): Promise<Response> {
	try {
		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return json({ error: 'Invalid request body' }, { status: 400 });
		}

		const result = bugReportSchema.safeParse(body);
		if (!result.success) {
			return json({ error: 'Validation failed', details: result.error.flatten() }, { status: 400 });
		}
		const parsed = result.data;
		const now = Date.now();
		const rateLimit = await limitBugReports(clientIp);
		if (rateLimit.degraded) {
			logger.warn('Bug report rate limiting is temporarily degraded');
		}
		if (!rateLimit.allowed) {
			const retryAfterMs = Math.max(0, (rateLimit.retryAt ?? now) - now);
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

		const issuePayload = {
			title: `[Bug] ${escapeMarkdown(parsed.title.replace(/[\r\n]+/g, ' ').trim())}`,
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
			logger.error('GitHub Issues API error', { status: response.status });
			return json({ error: 'Failed to submit bug report' }, { status: 500 });
		}

		const issue = (await response.json()) as { number: number; html_url: string };
		logger.info('Bug report submitted as GitHub issue', {
			issue: issue.number,
			url: issue.html_url,
			severity: parsed.severity
		});

		return json({ ok: true, id: `GH-${issue.number}` }, { status: 201 });
	} catch (err) {
		logger.error('Bug report error', { error: err });
		return json({ error: 'Failed to submit bug report' }, { status: 500 });
	}
}
