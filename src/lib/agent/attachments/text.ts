import { MAX_AGENT_TEXT_CHARS } from '#lib/agent/request.js';

export const COACH_TEXT_MAX_BYTES = 100 * 1024;
export const COACH_TEXT_MAX_CHARS = MAX_AGENT_TEXT_CHARS;

export const COACH_TEXT_TYPES = [
	'text/plain',
	'text/markdown',
	'text/csv',
	'text/tab-separated-values',
	'application/json'
] as const;

export type CoachTextMediaType = (typeof COACH_TEXT_TYPES)[number];

const COACH_TEXT_TYPE_SET = new Set<string>(COACH_TEXT_TYPES);

const COACH_TEXT_EXTENSIONS: Record<string, CoachTextMediaType> = {
	'.txt': 'text/plain',
	'.md': 'text/markdown',
	'.markdown': 'text/markdown',
	'.csv': 'text/csv',
	'.tsv': 'text/tab-separated-values',
	'.json': 'application/json'
};

export const COACH_TEXT_ACCEPT = [...COACH_TEXT_TYPES, ...Object.keys(COACH_TEXT_EXTENSIONS)].join(
	','
);

export function isCoachTextMediaType(mediaType: unknown): mediaType is CoachTextMediaType {
	return typeof mediaType === 'string' && COACH_TEXT_TYPE_SET.has(mediaType);
}

export function coachTextMediaTypeFromFilename(filename: unknown): CoachTextMediaType | null {
	if (typeof filename !== 'string' || !filename) return null;
	const match = /\.[^.]+$/u.exec(filename.trim().toLowerCase());
	if (!match) return null;
	return COACH_TEXT_EXTENSIONS[match[0]] ?? null;
}

export function resolveCoachTextMediaType(part: {
	mediaType?: unknown;
	filename?: unknown;
}): CoachTextMediaType | null {
	if (isCoachTextMediaType(part.mediaType)) return part.mediaType;
	return coachTextMediaTypeFromFilename(part.filename);
}

export function sanitizeCoachTextFilename(
	filename: unknown,
	mediaType: CoachTextMediaType
): string {
	const raw = typeof filename === 'string' ? filename.trim() : '';
	const base = raw.replace(/[/\\]/g, '').slice(0, 200);
	if (base && coachTextMediaTypeFromFilename(base)) return base;
	const fallback = {
		'text/plain': 'note.txt',
		'text/markdown': 'note.md',
		'text/csv': 'data.csv',
		'text/tab-separated-values': 'data.tsv',
		'application/json': 'data.json'
	}[mediaType];
	return base ? `${base}${fallback.slice(fallback.lastIndexOf('.'))}` : fallback;
}
