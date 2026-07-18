import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { building } from '$app/environment';

const LLMS_TXT_PATH = join(process.cwd(), 'static', 'llms.txt');

export function markdownResponse(markdown: string, init?: ResponseInit): Response {
	const headers = new Headers(init?.headers);
	headers.set('Content-Type', 'text/markdown; charset=utf-8');
	headers.set('x-markdown-tokens', String(Math.ceil(markdown.length / 4)));
	headers.set('Vary', appendVary(headers.get('Vary'), 'Accept'));

	return new Response(markdown, {
		...init,
		headers
	});
}

function appendVary(existing: string | null, value: string): string {
	if (!existing) return value;
	return existing
		.split(',')
		.map((part) => part.trim())
		.includes(value)
		? existing
		: `${existing}, ${value}`;
}

export function acceptsMarkdown(request: Request): boolean {
	const accept = request.headers.get('accept') ?? '';
	return /\btext\/markdown\b/i.test(accept);
}

export async function getHomepageMarkdown(): Promise<string> {
	if (building) {
		return '# Free AP Practice\n\n> AI-powered AP exam practice.\n';
	}

	return readFile(LLMS_TXT_PATH, 'utf8');
}

export function htmlToBasicMarkdown(html: string, fallbackTitle: string): string {
	const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
	const title = titleMatch?.[1]?.trim() ?? fallbackTitle;

	const descMatch =
		html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ??
		html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
	const description = descMatch?.[1]?.trim();

	const headingMatches = [...html.matchAll(/<h[12][^>]*>([^<]+)<\/h[12]>/gi)]
		.map((match) => match[1]?.trim())
		.filter(Boolean)
		.slice(0, 8);

	const lines = [`# ${title}`, ''];
	if (description) {
		lines.push(`> ${description}`, '');
	}
	for (const heading of headingMatches) {
		lines.push(`## ${heading}`, '');
	}

	return lines.join('\n').trimEnd() + '\n';
}
