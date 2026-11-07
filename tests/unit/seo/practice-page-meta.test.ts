import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getAllPageSlugs, getPageBySlug } from '#lib/catalog/practice-pages.js';
import { buildPracticePageMeta } from '#lib/seo/practice-page-meta.js';

type SeoProposal = {
	path: string;
	proposed_title: string;
	proposed_description: string;
};

function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let inQuotes = false;

	for (let index = 0; index < text.length; index += 1) {
		const char = text[index]!;
		if (inQuotes) {
			if (char === '"') {
				if (text[index + 1] === '"') {
					field += '"';
					index += 1;
				} else {
					inQuotes = false;
				}
			} else {
				field += char;
			}
			continue;
		}

		if (char === '"') {
			inQuotes = true;
			continue;
		}
		if (char === ',') {
			row.push(field);
			field = '';
			continue;
		}
		if (char === '\n') {
			if (field.endsWith('\r')) field = field.slice(0, -1);
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
			continue;
		}
		field += char;
	}

	if (field.length > 0 || row.length > 0) {
		row.push(field);
		rows.push(row);
	}

	return rows.filter((cells) => cells.some((cell) => cell.trim().length > 0));
}

function loadSeoProposals(): SeoProposal[] {
	const csvPath = resolve(process.cwd(), 'tests/fixtures/seo-title-proposals.csv');
	const [header, ...rows] = parseCsv(readFileSync(csvPath, 'utf8'));
	if (!header) throw new Error('SEO title proposals CSV is empty');

	const pathIndex = header.indexOf('path');
	const titleIndex = header.indexOf('proposed_title');
	const descriptionIndex = header.indexOf('proposed_description');
	if (pathIndex < 0 || titleIndex < 0 || descriptionIndex < 0) {
		throw new Error('SEO title proposals CSV is missing required columns');
	}

	return rows.map((cells) => ({
		path: cells[pathIndex] ?? '',
		proposed_title: cells[titleIndex] ?? '',
		proposed_description: cells[descriptionIndex] ?? ''
	}));
}

describe('buildPracticePageMeta', () => {
	const proposals = loadSeoProposals();

	it('covers every practice slug in the approved SEO CSV', () => {
		const csvSlugs = proposals.map((row) => row.path.replace(/^\/practice\//, ''));
		expect(csvSlugs).toHaveLength(205);
		expect(new Set(csvSlugs)).toEqual(new Set(getAllPageSlugs()));
	});

	it('uses the approved title and description for every practice page', () => {
		const mismatches: string[] = [];

		for (const proposal of proposals) {
			const slug = proposal.path.replace(/^\/practice\//, '');
			const page = getPageBySlug(slug);
			if (!page) {
				mismatches.push(`${proposal.path}: missing practice page`);
				continue;
			}

			const meta = buildPracticePageMeta(page);
			if (meta.title !== proposal.proposed_title) {
				mismatches.push(
					`${proposal.path} title\n  expected: ${proposal.proposed_title}\n  actual:   ${meta.title}`
				);
			}
			if (meta.description !== proposal.proposed_description) {
				mismatches.push(
					`${proposal.path} description\n  expected: ${proposal.proposed_description}\n  actual:   ${meta.description}`
				);
			}
		}

		expect(mismatches).toEqual([]);
	});
});
