import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const REPORTS_FILE = join(process.cwd(), 'src', 'data', 'bug-reports.json');

const reportSchema = z.object({
	title: z.string().min(5),
	description: z.string().min(10),
	steps: z.string().optional(),
	expected: z.string().optional(),
	severity: z.enum(['low', 'medium', 'high']).default('low'),
	email: z.string().email().optional(),
	metadata: z.record(z.string(), z.unknown()).optional()
});

async function ensureStorage() {
	if (!existsSync(REPORTS_FILE)) {
		await writeFile(REPORTS_FILE, '[]', 'utf8');
	}
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	try {
		const body = await request.json();
		const parsed = reportSchema.parse(body);

		const id = `BR-${Date.now()}`;
		const report = {
			id,
			status: 'open',
			createdAt: new Date().toISOString(),
			...parsed
		};

		await ensureStorage();
		const raw = await readFile(REPORTS_FILE, 'utf8');
		const records: unknown[] = JSON.parse(raw || '[]');
		records.unshift(report);
		await writeFile(REPORTS_FILE, JSON.stringify(records, null, 2), 'utf8');

		console.info('Bug report submitted', { id, severity: parsed.severity, title: parsed.title });

		return json({ ok: true, id }, { status: 201 });
	} catch (err) {
		if (err instanceof z.ZodError) {
			return json({ error: 'Validation failed', details: err.issues }, { status: 400 });
		}
		console.error('Bug report error:', err);
		return json({ error: 'Failed to submit bug report' }, { status: 500 });
	}
};
