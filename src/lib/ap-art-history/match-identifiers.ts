import type { ApArtHistoryWorkRow } from '#lib/ap-art-history/types.js';

export type IdentifierFieldKey = 'title' | 'artistLocation' | 'date' | 'medium';

export type IdentifierFieldResult = {
	key: IdentifierFieldKey;
	label: string;
	correct: boolean;
	notApplicable: boolean;
	userValue: string;
	expectedDisplay: string;
};

export type IdentifierGradeResult = {
	fields: IdentifierFieldResult[];
	allCorrect: boolean;
};

export type IdentifierInputs = {
	title: string;
	artistLocation: string;
	date: string;
	medium: string;
};

const SIMILARITY_THRESHOLD = 0.85;

const FIELD_LABELS: Record<IdentifierFieldKey, string> = {
	title: 'Title',
	artistLocation: 'Artist / location',
	date: 'Date',
	medium: 'Medium'
};

export function normalizeIdentifierText(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[\u2013\u2014]/g, '-')
		.replace(/\b(b\.?\s*c\.?\s*e\.?)\b/gi, 'bce')
		.replace(/\b(c\.?\s*e\.?)\b/gi, 'ce')
		.replace(/[^\p{L}\p{N}\s-]/gu, ' ')
		.replace(/-/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function levenshteinDistance(a: string, b: string): number {
	if (a === b) return 0;
	if (!a.length) return b.length;
	if (!b.length) return a.length;

	const rows = a.length + 1;
	const cols = b.length + 1;
	const matrix: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));

	for (let i = 0; i < rows; i++) matrix[i]![0] = i;
	for (let j = 0; j < cols; j++) matrix[0]![j] = j;

	for (let i = 1; i < rows; i++) {
		for (let j = 1; j < cols; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			matrix[i]![j] = Math.min(
				matrix[i - 1]![j]! + 1,
				matrix[i]![j - 1]! + 1,
				matrix[i - 1]![j - 1]! + cost
			);
		}
	}

	return matrix[a.length]![b.length]!;
}

export function similarityRatio(a: string, b: string): number {
	const left = normalizeIdentifierText(a);
	const right = normalizeIdentifierText(b);
	if (!left && !right) return 1;
	if (!left || !right) return 0;
	const distance = levenshteinDistance(left, right);
	const maxLen = Math.max(left.length, right.length);
	return maxLen === 0 ? 1 : 1 - distance / maxLen;
}

function fuzzyMatch(userValue: string, expected: string): boolean {
	if (!expected.trim()) return true;
	if (!userValue.trim()) return false;
	return similarityRatio(userValue, expected) >= SIMILARITY_THRESHOLD;
}

function formatArtistLocationDisplay(work: ApArtHistoryWorkRow): string {
	const artist = work.artist.trim();
	const location = work.location.trim();
	if (artist && location) return `${artist} — ${location}`;
	if (artist) return artist;
	if (location) return location;
	return '';
}

function gradeArtistLocation(work: ApArtHistoryWorkRow, userValue: string): IdentifierFieldResult {
	const artist = work.artist.trim();
	const location = work.location.trim();
	const expectedDisplay = formatArtistLocationDisplay(work);

	if (!artist && !location) {
		return {
			key: 'artistLocation',
			label: FIELD_LABELS.artistLocation,
			correct: true,
			notApplicable: true,
			userValue,
			expectedDisplay: 'Not specified on the CED'
		};
	}

	const candidates = [artist, location].filter(Boolean);
	const correct = candidates.some((candidate) => fuzzyMatch(userValue, candidate));

	return {
		key: 'artistLocation',
		label: FIELD_LABELS.artistLocation,
		correct,
		notApplicable: false,
		userValue,
		expectedDisplay
	};
}

export function gradeIdentifierInputs(
	work: ApArtHistoryWorkRow,
	inputs: IdentifierInputs
): IdentifierGradeResult {
	const fields: IdentifierFieldResult[] = [
		{
			key: 'title',
			label: FIELD_LABELS.title,
			correct: fuzzyMatch(inputs.title, work.titleDesignation),
			notApplicable: false,
			userValue: inputs.title,
			expectedDisplay: work.titleDesignation
		},
		gradeArtistLocation(work, inputs.artistLocation),
		{
			key: 'date',
			label: FIELD_LABELS.date,
			correct: fuzzyMatch(inputs.date, work.dateOfCreation),
			notApplicable: false,
			userValue: inputs.date,
			expectedDisplay: work.dateOfCreation
		},
		{
			key: 'medium',
			label: FIELD_LABELS.medium,
			correct: fuzzyMatch(inputs.medium, work.materials),
			notApplicable: false,
			userValue: inputs.medium,
			expectedDisplay: work.materials
		}
	];

	return {
		fields,
		allCorrect: fields.every((field) => field.correct)
	};
}
