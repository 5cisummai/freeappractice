import type { ApArtHistoryWorkRow } from '#lib/ap-art-history/types.js';

const CSV_HEADERS = [
	'number',
	'content_area',
	'title_designation',
	'artist',
	'culture',
	'location',
	'date_of_creation',
	'materials',
	'image_source',
	'college_board_source',
	'full_identifier',
	'image_count',
	'image_view_notes',
	'official_image_set_pages',
	'location_status',
	'identifier_notes'
] as const;

export function parseOfficialImageSetPages(raw: string): number[] {
	const trimmed = raw.trim();
	if (!trimmed) return [];
	const inner = trimmed.replace(/^\[|\]$/g, '').trim();
	if (!inner) return [];
	return inner
		.split(',')
		.map((part) => parseInt(part.trim(), 10))
		.filter((n) => Number.isFinite(n));
}

/** Parse a single-line CSV record with quoted fields. */
export function parseCsvLine(line: string): string[] {
	const fields: string[] = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];
		if (inQuotes) {
			if (char === '"') {
				if (line[i + 1] === '"') {
					current += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				current += char;
			}
			continue;
		}
		if (char === '"') {
			inQuotes = true;
			continue;
		}
		if (char === ',') {
			fields.push(current);
			current = '';
			continue;
		}
		current += char;
	}
	fields.push(current);
	return fields;
}

export function parseApArtHistoryCsv(text: string): ApArtHistoryWorkRow[] {
	const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
	if (lines.length < 2) {
		throw new Error('CSV must include a header row and at least one work');
	}

	const header = parseCsvLine(lines[0]);
	if (header.length !== CSV_HEADERS.length) {
		throw new Error(`Expected ${CSV_HEADERS.length} CSV columns, got ${header.length}`);
	}
	for (let i = 0; i < CSV_HEADERS.length; i++) {
		if (header[i] !== CSV_HEADERS[i]) {
			throw new Error(`Unexpected CSV header at column ${i + 1}: ${header[i]}`);
		}
	}

	const rows: ApArtHistoryWorkRow[] = [];
	for (let lineIndex = 1; lineIndex < lines.length; lineIndex++) {
		const fields = parseCsvLine(lines[lineIndex]);
		if (fields.length !== CSV_HEADERS.length) {
			throw new Error(
				`Row ${lineIndex + 1}: expected ${CSV_HEADERS.length} fields, got ${fields.length}`
			);
		}
		const number = parseInt(fields[0], 10);
		const imageCount = parseInt(fields[11], 10);
		if (!Number.isFinite(number) || !Number.isFinite(imageCount)) {
			throw new Error(`Row ${lineIndex + 1}: invalid number or image_count`);
		}
		rows.push({
			number,
			contentArea: fields[1],
			titleDesignation: fields[2],
			artist: fields[3],
			culture: fields[4],
			location: fields[5],
			dateOfCreation: fields[6],
			materials: fields[7],
			imageSource: fields[8],
			collegeBoardSource: fields[9],
			fullIdentifier: fields[10],
			imageCount,
			imageViewNotes: fields[12],
			officialImageSetPages: parseOfficialImageSetPages(fields[13]),
			locationStatus: fields[14],
			identifierNotes: fields[15]
		});
	}
	return rows;
}
