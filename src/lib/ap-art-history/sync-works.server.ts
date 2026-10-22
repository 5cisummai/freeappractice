import { sql } from 'drizzle-orm';
import { getNeonDatabase } from '#lib/server/neon/db.js';
import { apArtHistoryWorks } from '#lib/server/neon/schema/ap-art-history.js';
import { parseApArtHistoryCsv } from '#lib/ap-art-history/parse-csv.js';
import type { ApArtHistoryWorkRow } from '#lib/ap-art-history/types.js';

function rowToInsert(row: ApArtHistoryWorkRow) {
	return {
		number: row.number,
		contentArea: row.contentArea,
		titleDesignation: row.titleDesignation,
		artist: row.artist,
		culture: row.culture,
		location: row.location,
		dateOfCreation: row.dateOfCreation,
		materials: row.materials,
		imageSource: row.imageSource,
		collegeBoardSource: row.collegeBoardSource,
		fullIdentifier: row.fullIdentifier,
		imageCount: row.imageCount,
		imageViewNotes: row.imageViewNotes,
		officialImageSetPages: row.officialImageSetPages,
		locationStatus: row.locationStatus,
		identifierNotes: row.identifierNotes
	};
}

export async function upsertApArtHistoryWorks(rows: ApArtHistoryWorkRow[]): Promise<number> {
	if (rows.length === 0) return 0;
	const db = getNeonDatabase();
	const values = rows.map(rowToInsert);
	const now = new Date();

	await db
		.insert(apArtHistoryWorks)
		.values(values)
		.onConflictDoUpdate({
			target: apArtHistoryWorks.number,
			set: {
				contentArea: sql`excluded.content_area`,
				titleDesignation: sql`excluded.title_designation`,
				artist: sql`excluded.artist`,
				culture: sql`excluded.culture`,
				location: sql`excluded.location`,
				dateOfCreation: sql`excluded.date_of_creation`,
				materials: sql`excluded.materials`,
				imageSource: sql`excluded.image_source`,
				collegeBoardSource: sql`excluded.college_board_source`,
				fullIdentifier: sql`excluded.full_identifier`,
				imageCount: sql`excluded.image_count`,
				imageViewNotes: sql`excluded.image_view_notes`,
				officialImageSetPages: sql`excluded.official_image_set_pages`,
				locationStatus: sql`excluded.location_status`,
				identifierNotes: sql`excluded.identifier_notes`,
				updatedAt: now
			}
		});

	return rows.length;
}

export async function syncApArtHistoryWorksFromCsvText(csvText: string): Promise<number> {
	const rows = parseApArtHistoryCsv(csvText);
	return upsertApArtHistoryWorks(rows);
}
