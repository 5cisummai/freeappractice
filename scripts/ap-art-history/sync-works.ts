/**
 * Upsert AP Art History 250 CED works from the research CSV into Neon.
 *
 *   bun --preload ./scripts/bun-sveltekit-env-preload.ts scripts/ap-art-history/sync-works.ts
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { syncApArtHistoryWorksFromCsvText } from '../../src/lib/ap-art-history/sync-works.server.ts';

const defaultCsvPath = resolve(process.cwd(), 'docs/research/ap-art-history-250-image-set.csv');

async function main() {
	const csvPath = process.argv[2]?.trim() || defaultCsvPath;
	const csvText = await readFile(csvPath, 'utf8');
	const count = await syncApArtHistoryWorksFromCsvText(csvText);
	console.log(`Synced ${count} AP Art History works from ${csvPath}`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
