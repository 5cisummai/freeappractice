import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { RequestHandler } from './$types';

export const prerender = false;

const currentFilePath = fileURLToPath(import.meta.url);
const dataDirectoryPath = dirname(currentFilePath);

/** Canonical copy lives in $lib/data; served here for /data downloads. */
const LIB_DATA_ALIASES: Record<string, string> = {
	'ap-classes.json': join(dirname(currentFilePath), '..', '..', 'lib', 'data', 'ap-classes.json')
};

const contentTypes: Record<string, string> = {
	'.json': 'application/json; charset=utf-8',
	'.txt': 'text/plain; charset=utf-8'
};

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

export const GET: RequestHandler = async ({ url }) => {
	const entries = await readdir(dataDirectoryPath, { withFileTypes: true });

	const localFiles = entries
		.filter((entry) => entry.isFile() && entry.name !== '+server.ts')
		.map((entry) => entry.name);

	const files = [...new Set([...localFiles, ...Object.keys(LIB_DATA_ALIASES)])].sort(
		(left, right) => left.localeCompare(right)
	);

	const requestedFile = url.searchParams.get('file');

	if (requestedFile) {
		if (!files.includes(requestedFile)) {
			return new Response('File not found.', { status: 404 });
		}

		const filePath = LIB_DATA_ALIASES[requestedFile] ?? join(dataDirectoryPath, requestedFile);
		const fileBuffer = await readFile(filePath);
		const contentType =
			contentTypes[extname(requestedFile).toLowerCase()] ?? 'application/octet-stream';

		return new Response(fileBuffer, {
			status: 200,
			headers: {
				'Content-Type': contentType,
				'Content-Disposition': `attachment; filename="${requestedFile.replaceAll('"', '')}"`
			}
		});
	}

	const fileItems = files
		.map((fileName) => {
			const href = `/data?file=${encodeURIComponent(fileName)}`;
			const safeName = escapeHtml(fileName);
			return `<li><a href="${href}" download="${safeName}">${safeName}</a></li>`;
		})
		.join('');

	const html = `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>Data Directory</title>
		<style>
			body {
				font-family: ui-sans-serif, system-ui, sans-serif;
				margin: 2rem;
				line-height: 1.5;
			}
			h1 {
				margin-bottom: 0.5rem;
			}
			ul {
				padding-left: 1.25rem;
			}
			li + li {
				margin-top: 0.5rem;
			}
			a {
				color: #0f62fe;
				text-decoration: none;
			}
			a:hover {
				text-decoration: underline;
			}
			.back-home {
				display: inline-flex;
				align-items: center;
				gap: 0.375rem;
				margin-top: 1.5rem;
				padding: 0.5rem 0.625rem;
				border-radius: 0.375rem;
				color: inherit;
				text-decoration: none;
			}
			.back-home:hover {
				background: #f4f4f5;
				text-decoration: none;
			}
			.back-home svg {
				width: 1rem;
				height: 1rem;
				flex-shrink: 0;
			}
		</style>
	</head>
	<body>
		<h1>Data Directory</h1>
		<p>Select a file to download.</p>
		<ul>${fileItems}</ul>
		<a href="/" class="back-home">
			<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
			Back to Home
		</a>
	</body>
</html>`;

	return new Response(html, {
		status: 200,
		headers: {
			'Content-Type': 'text/html; charset=utf-8'
		}
	});
};
