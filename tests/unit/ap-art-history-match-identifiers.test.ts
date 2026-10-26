import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseApArtHistoryCsv } from '#lib/ap-art-history/parse-csv.js';
import {
	gradeIdentifierInputs,
	normalizeIdentifierText,
	similarityRatio
} from '#lib/ap-art-history/match-identifiers.js';
import type { ApArtHistoryWorkRow } from '#lib/ap-art-history/types.js';

const baseWork: ApArtHistoryWorkRow = {
	number: 8,
	contentArea: '1. Global Prehistory, 30,000–500 B.C.E.',
	titleDesignation: 'Stonehenge',
	artist: '',
	culture: 'Neolithic Europe',
	location: 'Wiltshire, UK',
	dateOfCreation: 'c. 2500–1600 B.C.E.',
	materials: 'Sandstone',
	imageSource: 'https://example.com/image.pdf#page=53',
	collegeBoardSource: 'https://example.com/ced.pdf#page=350',
	fullIdentifier: 'Stonehenge. Wiltshire, UK.',
	imageCount: 2,
	imageViewNotes: '',
	officialImageSetPages: [53],
	locationStatus: 'specified_by_college_board',
	identifierNotes: ''
};

describe('match-identifiers', () => {
	it('normalizes punctuation and case for comparison', () => {
		expect(normalizeIdentifierText('  Stone-Henge! ')).toBe('stone henge');
		expect(similarityRatio('Stonehenge', 'stone henge')).toBeGreaterThanOrEqual(0.85);
	});

	it('grades title, date, and medium with fuzzy tolerance', () => {
		const result = gradeIdentifierInputs(baseWork, {
			title: 'stonehenge',
			artistLocation: 'Wiltshire UK',
			date: 'c. 2500-1600 B.C.E.',
			medium: 'sandstone'
		});

		expect(result.allCorrect).toBe(true);
		expect(result.fields.find((f) => f.key === 'title')?.correct).toBe(true);
		expect(result.fields.find((f) => f.key === 'artistLocation')?.correct).toBe(true);
	});

	it('treats empty artist and location as N/A', () => {
		const work: ApArtHistoryWorkRow = {
			...baseWork,
			artist: '',
			location: '',
			titleDesignation: 'Apollo 11 stones'
		};

		const result = gradeIdentifierInputs(work, {
			title: 'Apollo 11 stones',
			artistLocation: '',
			date: work.dateOfCreation,
			medium: work.materials
		});

		const artistField = result.fields.find((f) => f.key === 'artistLocation');
		expect(artistField?.notApplicable).toBe(true);
		expect(artistField?.correct).toBe(true);
	});

	it('accepts artist when location is blank on the work', () => {
		const work: ApArtHistoryWorkRow = {
			...baseWork,
			artist: 'Ai Weiwei',
			location: '',
			titleDesignation: 'Kui Hua Zi (Sunflower Seeds)'
		};

		const result = gradeIdentifierInputs(work, {
			title: work.titleDesignation,
			artistLocation: 'Ai Weiwei',
			date: work.dateOfCreation,
			medium: work.materials
		});

		expect(result.fields.find((f) => f.key === 'artistLocation')?.correct).toBe(true);
	});
});

const works = parseApArtHistoryCsv(
	readFileSync(
		new URL('../../docs/research/ap-art-history-250-image-set.csv', import.meta.url),
		'utf8'
	)
);

function gradeField(
	work: ApArtHistoryWorkRow,
	key: 'title' | 'artistLocation' | 'date' | 'medium',
	value: string
) {
	return gradeIdentifierInputs(work, {
		title: work.titleDesignation,
		artistLocation: work.artist || work.location,
		date: work.dateOfCreation,
		medium: work.materials,
		[key]: value
	}).fields.find((field) => field.key === key)!.correct;
}

describe('realistic identifier variations', () => {
	it.each([
		['title', 'Stonehnege', true],
		['title', 'Stone henge', true],
		['title', 'Parthenon', false],
		['title', '!!!', false],
		['artistLocation', 'UK Wiltshire', true],
		['artistLocation', 'Wiltshire', false],
		['medium', 'Sandstnoe', true],
		['medium', 'Marble', false],
		['date', '2500–1600 BCE', true],
		['date', 'circa 2500 BCE to 1600 BCE', true],
		['date', 'c. 2500–1600 C.E.', false],
		['date', '2500–1600', false],
		['date', '2500–1601 BCE', false],
		['date', '2500 BCE', false],
		['date', '1600–2500 BCE', false]
	] as const)('%s: %s -> %s', (key, value, correct) => {
		expect(gradeField(baseWork, key, value)).toBe(correct);
	});

	it.each([
		[250, 'title', 'Sunflower Seeds', true],
		[250, 'title', 'Kui Hua Zi', true],
		[250, 'title', 'Seeds', false],
		[250, 'title', 'Sunflower Seeds and Marble', false],
		[10, 'artistLocation', 'Tlatilco central Mexico', true],
		[10, 'medium', 'ceramiic', true],
		[3, 'medium', 'Gone', false],
		[131, 'title', 'Goldfish', true],
		[132, 'title', 'Improvisation 29 (second version)', false],
		[120, 'medium', 'Oil paint on canvas', true],
		[5, 'medium', 'Painted terracotta', true],
		[120, 'date', '1889', true],
		[120, 'date', '1889 AD', true],
		[120, 'date', '1889 BC', false],
		[26, 'date', '600 BCE to 150 CE', true],
		[26, 'date', '600–150 CE', false],
		[6, 'date', 'Fourth millennium CE', false],
		[6, 'date', '4th millennium BC', true],
		[6, 'date', 'fourth millennium B.C.', true],
		[6, 'date', 'third millennium BCE', false],
		[164, 'date', 'Late nineteenth century CE', true],
		[164, 'date', 'Early nineteenth century CE', false],
		[20, 'date', 'Temple: c. 1550 BCE; hall: c. 1251 BCE', false]
	] as const)('work %s %s: %s -> %s', (number, key, value, correct) => {
		expect(
			gradeField(
				works.find((work) => work.number === number)!,
				key,
				value
			)
		).toBe(correct);
	});

	it('accepts exact and normalized answers for all 250 works, rejects blanks and wrong eras', () => {
		for (const work of works) {
			for (const [key, value] of Object.entries({
				title: work.titleDesignation,
				artistLocation: work.artist || work.location,
				date: work.dateOfCreation,
				medium: work.materials
			})) {
				const field = key as 'title' | 'artistLocation' | 'date' | 'medium';
				expect(gradeField(work, field, value), `work ${work.number}: ${key}`).toBe(true);
				expect(gradeField(work, field, `  ${value.toUpperCase()}  `)).toBe(true);
				if (value) expect(gradeField(work, field, '')).toBe(false);
			}
			if (work.dateOfCreation.includes('B.C.E.')) {
				expect(gradeField(work, 'date', work.dateOfCreation.replaceAll('B.C.E.', 'C.E.'))).toBe(
					false
				);
			}
			if (work.artist && work.location) {
				expect(gradeField(work, 'artistLocation', `${work.artist} — ${work.location}`)).toBe(true);
				expect(gradeField(work, 'artistLocation', work.artist)).toBe(true);
				expect(gradeField(work, 'artistLocation', work.location)).toBe(true);
			}
		}
	});
});
