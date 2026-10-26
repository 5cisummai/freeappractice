import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseApArtHistoryCsv } from '#lib/ap-art-history/parse-csv.js';

describe('parseApArtHistoryCsv', () => {
	it('parses the research CSV with 250 works', async () => {
		const csvPath = resolve('docs/research/ap-art-history-250-image-set.csv');
		const text = await readFile(csvPath, 'utf8');
		const rows = parseApArtHistoryCsv(text);
		expect(rows).toHaveLength(250);
		expect(rows[0].number).toBe(1);
		expect(rows[0].titleDesignation).toBe('Apollo 11 stones');
		expect(rows[249].number).toBe(250);
		expect(rows[198].officialImageSetPages).toEqual([255, 256]);
	});
});
