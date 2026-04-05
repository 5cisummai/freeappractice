import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { RequestHandler } from './$types';

const currentFilePath = fileURLToPath(import.meta.url);
const dataDirectoryPath = dirname(currentFilePath);

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

	const files = entries
		.filter((entry) => entry.isFile() && entry.name !== '+server.ts')
		.map((entry) => entry.name)
		.sort((left, right) => left.localeCompare(right));

	const requestedFile = url.searchParams.get('file');

	if (requestedFile) {
		if (!files.includes(requestedFile)) {
			return new Response('File not found.', { status: 404 });
		}

		const fileBuffer = await readFile(join(dataDirectoryPath, requestedFile));
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
		</style>
	</head>
	<body>
		<h1>Data Directory</h1>
		<p>Select a file to download.</p>
		<ul>${fileItems}</ul>
        <a href="/">Back to Home</a>
	</body>
</html>`;

	return new Response(html, {
		status: 200,
		headers: {
			'Content-Type': 'text/html; charset=utf-8'
		}
	});
};
