import sharp from 'sharp';
import {
	COACH_IMAGE_MAX_BYTES,
	COACH_IMAGE_MAX_DIMENSION,
	COACH_IMAGE_MAX_PIXELS
} from '#lib/agent/attachments/images.js';
import {
	COACH_TEXT_MAX_BYTES,
	COACH_TEXT_MAX_CHARS,
	type CoachTextMediaType,
	resolveCoachTextMediaType,
	sanitizeCoachTextFilename
} from '#lib/agent/attachments/text.js';

export class CoachImageError extends Error {}

export type CoachTextFile = {
	mediaType: CoachTextMediaType;
	filename: string;
	text: string;
	url: string;
};

export async function validateCoachImage(part: Record<string, unknown>): Promise<Buffer> {
	const match =
		typeof part.url === 'string' &&
		/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(part.url);
	if (!match || part.mediaType !== match[1])
		throw new CoachImageError('Use a PNG, JPEG, or WebP image.');
	if (match[2].length > Math.ceil(COACH_IMAGE_MAX_BYTES / 3) * 4)
		throw new CoachImageError('Images must be 2 MB or smaller.');
	const bytes = Buffer.from(match[2], 'base64');
	if (
		!bytes.length ||
		bytes.length > COACH_IMAGE_MAX_BYTES ||
		bytes.toString('base64') !== match[2]
	)
		throw new CoachImageError('Invalid image or image larger than 2 MB.');
	try {
		const image = sharp(bytes, { limitInputPixels: COACH_IMAGE_MAX_PIXELS, failOn: 'warning' });
		const metadata = await image.metadata();
		const expected = { 'image/png': 'png', 'image/jpeg': 'jpeg', 'image/webp': 'webp' }[match[1]];
		if (
			metadata.format !== expected ||
			!metadata.width ||
			!metadata.height ||
			metadata.width > COACH_IMAGE_MAX_DIMENSION ||
			metadata.height > COACH_IMAGE_MAX_DIMENSION ||
			(metadata.pages ?? 1) > 1
		)
			throw new Error('Unsupported dimensions or animation');
		// Decode and re-encode; Sharp drops EXIF and other metadata by default.
		const normalized = await image
			.rotate()
			.resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
			.webp({ quality: 90 })
			.toBuffer();
		if (normalized.length > COACH_IMAGE_MAX_BYTES) throw new Error('Normalized image too large');
		return normalized;
	} catch {
		throw new CoachImageError(
			'Use a valid still image, up to 8192 pixels per side and 16 megapixels.'
		);
	}
}

export function validateCoachTextFile(part: Record<string, unknown>): CoachTextFile {
	const mediaType = resolveCoachTextMediaType(part);
	if (!mediaType) throw new CoachImageError('Use a TXT, Markdown, CSV, TSV, or JSON file.');
	const match =
		typeof part.url === 'string' &&
		/^data:([^;,]*?)(?:;charset=utf-8)?;base64,([A-Za-z0-9+/]+={0,2})$/i.exec(part.url);
	if (!match) throw new CoachImageError('Use a TXT, Markdown, CSV, TSV, or JSON file.');
	const dataTypeRaw = match[1].toLowerCase();
	const dataType =
		!dataTypeRaw || dataTypeRaw === 'application/octet-stream'
			? null
			: resolveCoachTextMediaType({ mediaType: dataTypeRaw, filename: part.filename });
	if (dataTypeRaw && !dataType && dataTypeRaw !== 'application/octet-stream')
		throw new CoachImageError('Use a TXT, Markdown, CSV, TSV, or JSON file.');
	if (dataType && dataType !== mediaType)
		throw new CoachImageError('Use a TXT, Markdown, CSV, TSV, or JSON file.');
	if (match[2].length > Math.ceil(COACH_TEXT_MAX_BYTES / 3) * 4)
		throw new CoachImageError('Text files must be 100 KB or smaller.');
	const bytes = Buffer.from(match[2], 'base64');
	if (!bytes.length || bytes.length > COACH_TEXT_MAX_BYTES || bytes.toString('base64') !== match[2])
		throw new CoachImageError('Invalid text file or file larger than 100 KB.');
	if (bytes.includes(0)) throw new CoachImageError('Text files must be valid UTF-8 text.');
	let text: string;
	try {
		text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		throw new CoachImageError('Text files must be valid UTF-8 text.');
	}
	if (text.length > COACH_TEXT_MAX_CHARS)
		throw new CoachImageError(
			`Text files must be ${COACH_TEXT_MAX_CHARS.toLocaleString()} characters or fewer.`
		);
	const filename = sanitizeCoachTextFilename(part.filename, mediaType);
	const url = `data:${mediaType};base64,${Buffer.from(text, 'utf8').toString('base64')}`;
	return { mediaType, filename, text, url };
}
