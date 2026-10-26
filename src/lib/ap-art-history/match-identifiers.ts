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

// Alternate names are curated, rather than treating every parenthesis as a title.
const TITLE_ALIASES: Record<number, string[]> = {
	34: ['Doryphoros', 'Spear Bearer'],
	44: ['Colosseum', 'Flavian Amphitheater'],
	66: ['Annunciation Triptych', 'Merode Altarpiece'],
	95: ['The Virgin of Guadalupe', 'Virgen de Guadalupe'],
	112: ['Palace of Westminster', 'Houses of Parliament'],
	138: ['Object', 'Le Déjeuner en fourrure'],
	157: ['Templo Mayor', 'Main Temple'],
	170: ['Sika dwa kofi', 'Golden Stool'],
	202: ['Shiva as Lord of Dance', 'Nataraja'],
	211: ['Under the Wave off Kanagawa', 'Kanagawa oki nami ura', 'The Great Wave'],
	236: ['En la Barberia no se Llora', 'No Crying Allowed in the Barbershop'],
	237: ['Pisupo Lua Afe', 'Corned Beef 2000'],
	250: ['Kui Hua Zi', 'Sunflower Seeds']
};

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

function editDistance(a: string, b: string): number {
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
			// Optimal string alignment: an adjacent transposition costs one edit.
			if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
				matrix[i]![j] = Math.min(matrix[i]![j]!, matrix[i - 2]![j - 2]! + 1);
			}
		}
	}

	return matrix[a.length]![b.length]!;
}

export function similarityRatio(a: string, b: string): number {
	const left = normalizeIdentifierText(a);
	const right = normalizeIdentifierText(b);
	if (!left && !right) return 1;
	if (!left || !right) return 0;
	const distance = editDistance(left, right);
	const maxLen = Math.max(left.length, right.length);
	return maxLen === 0 ? 1 : 1 - distance / maxLen;
}

function closeText(left: string, right: string): boolean {
	if (left === right) return true;
	// Numbers identify works too (e.g. Improvisation 28); never typo-match them.
	if ((left.match(/\d+/g) ?? []).join(',') !== (right.match(/\d+/g) ?? []).join(',')) return false;
	const length = Math.min(left.length, right.length);
	const allowed = length < 5 ? 0 : length < 12 ? 1 : Math.min(3, Math.floor(length * 0.1));
	return editDistance(left, right) <= allowed;
}

const OPTIONAL_WORDS = new Set(['a', 'an', 'the', 'of', 'from', 'at', 'in', 'and', 'site']);

function fuzzyMatch(userValue: string, expected: string): boolean {
	if (!expected.trim()) return true;
	const left = normalizeIdentifierText(userValue);
	const right = normalizeIdentifierText(expected);
	if (!left) return false;
	if (closeText(left, right)) return true;
	const words = (text: string) => text.split(' ').filter((word) => !OPTIONAL_WORDS.has(word));
	const remaining = words(right);
	const inputWords = words(left);
	// Require every meaningful word on both sides, not just a shared substring.
	if (!inputWords.length || inputWords.length !== remaining.length) return false;
	// Reserve exact matches first so a fuzzy match cannot steal another word's match.
	const unmatched = inputWords.filter((word) => {
		const index = remaining.indexOf(word);
		if (index < 0) return true;
		remaining.splice(index, 1);
		return false;
	});
	return unmatched.every((word) => {
		const index = remaining.findIndex((candidate) => closeText(word, candidate));
		if (index < 0) return false;
		remaining.splice(index, 1);
		return true;
	});
}

const ORDINALS = [
	'first',
	'second',
	'third',
	'fourth',
	'fifth',
	'sixth',
	'seventh',
	'eighth',
	'ninth',
	'tenth',
	'eleventh',
	'twelfth',
	'thirteenth',
	'fourteenth',
	'fifteenth',
	'sixteenth',
	'seventeenth',
	'eighteenth',
	'nineteenth',
	'twentieth'
];

function normalizeDate(value: string): string {
	return normalizeIdentifierText(
		value
			.replace(/(\d),(?=\d{3}\b)/g, '$1')
			.replace(/\bb\.\s*c\.(?:\s*e\.)?/gi, 'bce')
			.replace(/\ba\.\s*d\./gi, 'ce')
	)
		.replace(/\b(?:circa|ca|c)\b/g, '')
		.replace(/\bbc\b/g, 'bce')
		.replace(/\bad\b/g, 'ce')
		.replace(/\bto\b/g, ' ')
		.replace(/\b(\d+)(?:st|nd|rd|th)\b/g, '$1')
		.replace(new RegExp(`\\b(${ORDINALS.join('|')})\\b`, 'g'), (word) =>
			String(ORDINALS.indexOf(word) + 1)
		)
		.replace(/\s+/g, ' ')
		.trim();
}

function simpleDate(value: string): number[] | null {
	const match = value.match(/^(\d+)\s*(bce|ce)?(?:\s+(\d+)\s*(bce|ce)?)?$/);
	if (!match) return null;
	const endEra = match[4] ?? match[2] ?? 'ce';
	const startEra = match[2] ?? endEra;
	const signed = (year: string, era: string) => Number(year) * (era === 'bce' ? -1 : 1);
	return match[3]
		? [signed(match[1]!, startEra), signed(match[3], endEra)]
		: [signed(match[1]!, startEra)];
}

function matchDate(userValue: string, expected: string): boolean {
	const left = normalizeDate(userValue);
	const right = normalizeDate(expected);
	if (!left) return false;
	if (left === right) return true;
	const inputDate = simpleDate(left);
	const expectedDate = simpleDate(right);
	if (inputDate && expectedDate) return inputDate.join(',') === expectedDate.join(',');
	// Preserve all numbers, eras and qualifiers for compound dates and centuries.
	// Fuzzy prose would otherwise accept a different century, era or construction phase.
	return false;
}

function normalizeMedium(value: string): string {
	return normalizeIdentifierText(value)
		.replace(/\bwatercolour\b/g, 'watercolor')
		.replace(/\baluminium\b/g, 'aluminum')
		.replace(/\bterra cotta\b/g, 'terracotta')
		.replace(/\boil paint\b/g, 'oil');
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

	const candidates = [artist, location, expectedDisplay].filter(Boolean);
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
			correct: [work.titleDesignation, ...(TITLE_ALIASES[work.number] ?? [])].some((title) =>
				fuzzyMatch(inputs.title, title)
			),
			notApplicable: false,
			userValue: inputs.title,
			expectedDisplay: work.titleDesignation
		},
		gradeArtistLocation(work, inputs.artistLocation),
		{
			key: 'date',
			label: FIELD_LABELS.date,
			correct: matchDate(inputs.date, work.dateOfCreation),
			notApplicable: false,
			userValue: inputs.date,
			expectedDisplay: work.dateOfCreation
		},
		{
			key: 'medium',
			label: FIELD_LABELS.medium,
			correct: fuzzyMatch(normalizeMedium(inputs.medium), normalizeMedium(work.materials)),
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
