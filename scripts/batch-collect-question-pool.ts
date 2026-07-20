/**
 * scripts/batch-collect-question-pool.ts
 *
 * Download a completed OpenAI Batch and persist MCQs to S3 + Mongo pool.
 *
 *   bun run pool:batch-collect -- --batch batch_...
 *   bun run pool:batch-collect -- --batch batch_... --dry-run
 */

import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
	downloadOpenAiFile,
	extractPoolBatchOutputText,
	retrieveOpenAiBatch,
	type PoolBatchManifest
} from '../src/lib/questions/pool-batch.server';
import { apQuestionSchema } from '../src/lib/questions/generation.server';
import { persistParsedQuestionToPool } from '../src/lib/questions/pool-write.server';
import { connectDb } from '../src/lib/server/db';

function argValue(flag: string): string | undefined {
	const eq = process.argv.find((a) => a.startsWith(`${flag}=`));
	if (eq) return eq.slice(flag.length + 1);
	const idx = process.argv.indexOf(flag);
	return idx >= 0 ? process.argv[idx + 1] : undefined;
}

const dryRun = process.argv.includes('--dry-run');
const batchId = argValue('--batch');
const MANIFEST_DIR = path.resolve('tmp/pool-batches');

async function loadManifest(id: string): Promise<PoolBatchManifest & { batchId?: string }> {
	const manifestPath = path.join(MANIFEST_DIR, `${id}.json`);
	const raw = await readFile(manifestPath, 'utf8');
	return JSON.parse(raw) as PoolBatchManifest & { batchId?: string };
}

async function main() {
	if (!batchId) {
		console.error('Usage: bun run pool:batch-collect -- --batch batch_...');
		process.exit(1);
	}
	if (!process.env.DATABASE_URI) {
		console.error('DATABASE_URI is not set');
		process.exit(1);
	}
	if (!process.env.OPEN_AI_KEY) {
		console.error('OPEN_AI_KEY is not set');
		process.exit(1);
	}

	const manifest = await loadManifest(batchId);
	const batch = await retrieveOpenAiBatch(batchId);
	console.log('Batch status', {
		batchId: batch.id,
		status: batch.status,
		output_file_id: batch.output_file_id ?? null,
		error_file_id: batch.error_file_id ?? null,
		manifestEntries: Object.keys(manifest.entries).length
	});

	if (batch.status !== 'completed') {
		console.log(`Batch is not completed yet (status=${batch.status}). Re-run later.`);
		process.exit(0);
	}
	if (!batch.output_file_id) {
		console.error('Batch completed but has no output_file_id');
		process.exit(1);
	}

	if (batch.error_file_id) {
		const errors = await downloadOpenAiFile(batch.error_file_id);
		console.warn(`Error file present (${batch.error_file_id}), first 2k chars:\n${errors.slice(0, 2000)}`);
	}

	const contents = await downloadOpenAiFile(batch.output_file_id);
	const lines = contents.split('\n').filter(Boolean);
	console.log(`Downloaded ${lines.length} output lines`);

	if (!dryRun) await connectDb();

	let ok = 0;
	let skippedDuplicate = 0;
	let failed = 0;
	let missingManifest = 0;

	for (const line of lines) {
		let parsed: {
			custom_id: string;
			response?: { status_code?: number; body?: unknown };
			error?: { message?: string } | null;
		};
		try {
			parsed = JSON.parse(line) as typeof parsed;
		} catch {
			failed += 1;
			console.error('Invalid JSONL line');
			continue;
		}

		const entry = manifest.entries[parsed.custom_id];
		if (!entry) {
			missingManifest += 1;
			console.error(`No manifest entry for custom_id=${parsed.custom_id}`);
			continue;
		}

		if (parsed.error || !parsed.response?.body || parsed.response.status_code !== 200) {
			failed += 1;
			console.error(`Request failed custom_id=${parsed.custom_id}`, {
				error: parsed.error?.message,
				status: parsed.response?.status_code
			});
			continue;
		}

		try {
			const text = extractPoolBatchOutputText(parsed.response.body);
			const answer = apQuestionSchema.parse(JSON.parse(text));
			if (dryRun) {
				ok += 1;
				continue;
			}
			const result = await persistParsedQuestionToPool(entry.apClass, entry.unit, answer);
			if (result.skippedDuplicate) skippedDuplicate += 1;
			else ok += 1;
		} catch (error) {
			failed += 1;
			console.error(`Persist failed custom_id=${parsed.custom_id}`, error);
		}
	}

	console.log('Collect complete', {
		ok,
		skippedDuplicate,
		failed,
		missingManifest,
		dryRun
	});
	process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
