import { describe, expect, it } from 'vitest';
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
