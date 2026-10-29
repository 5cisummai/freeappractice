/**
 * Upsert AP Art History 250 CED works from the research CSV into Neon.
 * Idempotent — ON CONFLICT (number) DO UPDATE. Safe to re-run from CI after db:apply.
 *
 *   bun run db:sync-ap-art-history
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';
import { parseApArtHistoryCsv } from '../../src/lib/ap-art-history/parse-csv.ts';
import type { ApArtHistoryWorkRow } from '../../src/lib/ap-art-history/types.ts';

const COLUMNS_PER_ROW = 16;
const defaultCsvPath = resolve(process.cwd(), 'docs/research/ap-art-history-250-image-set.csv');

function rowParams(row: ApArtHistoryWorkRow): unknown[] {
	return [
		row.number,
		row.contentArea,
		row.titleDesignation,
		row.artist,
		row.culture,
		row.location,
		row.dateOfCreation,
		row.materials,
		row.imageSource,
		row.collegeBoardSource,
		row.fullIdentifier,
		row.imageCount,
		row.imageViewNotes,
		JSON.stringify(row.officialImageSetPages),
		row.locationStatus,
		row.identifierNotes
	];
}

export async function syncApArtHistoryWorks(
	sql: { query: (text: string, params?: unknown[]) => Promise<unknown> },
	rows: ApArtHistoryWorkRow[]
): Promise<number> {
	if (rows.length === 0) return 0;

	const values = rows
		.map((_, index) => {
			const base = index * COLUMNS_PER_ROW;
			return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10},$${base + 11},$${base + 12},$${base + 13},$${base + 14}::jsonb,$${base + 15},$${base + 16})`;
		})
		.join(',');

	await sql.query(
		`INSERT INTO ap_art_history.works (
			number, content_area, title_designation, artist, culture, location,
			date_of_creation, materials, image_source, college_board_source,
			full_identifier, image_count, image_view_notes, official_image_set_pages,
			location_status, identifier_notes
		) VALUES ${values}
		ON CONFLICT (number) DO UPDATE SET
			content_area = EXCLUDED.content_area,
			title_designation = EXCLUDED.title_designation,
			artist = EXCLUDED.artist,
			culture = EXCLUDED.culture,
			location = EXCLUDED.location,
			date_of_creation = EXCLUDED.date_of_creation,
			materials = EXCLUDED.materials,
			image_source = EXCLUDED.image_source,
			college_board_source = EXCLUDED.college_board_source,
			full_identifier = EXCLUDED.full_identifier,
			image_count = EXCLUDED.image_count,
			image_view_notes = EXCLUDED.image_view_notes,
			official_image_set_pages = EXCLUDED.official_image_set_pages,
			location_status = EXCLUDED.location_status,
			identifier_notes = EXCLUDED.identifier_notes,
			updated_at = NOW()`,
		rows.flatMap(rowParams)
	);
	return rows.length;
}

async function main(): Promise<void> {
	const databaseUrl = process.env.DATABASE_URL?.trim();
	if (!databaseUrl) throw new Error('DATABASE_URL is required');
	if (!/^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
		throw new Error('DATABASE_URL must be a Neon PostgreSQL connection string');
	}

	const csvPath = process.argv[2]?.trim() || defaultCsvPath;
	const rows = parseApArtHistoryCsv(await readFile(csvPath, 'utf8'));
	const count = await syncApArtHistoryWorks(neon(databaseUrl), rows);
	console.log(`Synced ${count} AP Art History works from ${csvPath}`);
}

if (import.meta.main) {
	void main().catch((error) => {
		console.error(error);
		process.exitCode = 1;
	});
}
