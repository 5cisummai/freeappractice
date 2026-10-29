import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseApArtHistoryCsv } from '#lib/ap-art-history/parse-csv.js';
import { syncApArtHistoryWorks } from '../../scripts/ap-art-history/sync-works.ts';

describe('syncApArtHistoryWorks', () => {
	it('issues an idempotent bulk upsert for CED works', async () => {
		const csvText = await readFile(
			resolve('docs/research/ap-art-history-250-image-set.csv'),
			'utf8'
		);
		const rows = parseApArtHistoryCsv(csvText).slice(0, 2);
		let text = '';
		let params: unknown[] = [];
		const count = await syncApArtHistoryWorks(
			{
				query: async (query, queryParams) => {
					text = query;
					params = queryParams ?? [];
					return [];
				}
			},
			rows
		);

		expect(count).toBe(2);
		expect(text).toContain('INSERT INTO ap_art_history.works');
		expect(text).toContain('ON CONFLICT (number) DO UPDATE');
		expect(text).toContain('updated_at = NOW()');
		expect(text).not.toContain('DROP ');
		expect(params).toHaveLength(32);
		expect(params[0]).toBe(1);
		expect(params[16]).toBe(2);
	});

	it('is a no-op for an empty row list', async () => {
		let called = false;
		const count = await syncApArtHistoryWorks(
			{
				query: async () => {
					called = true;
					return [];
				}
			},
			[]
		);
		expect(count).toBe(0);
		expect(called).toBe(false);
	});
});
