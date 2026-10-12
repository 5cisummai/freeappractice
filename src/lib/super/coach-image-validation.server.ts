import sharp from 'sharp';
import {
	COACH_IMAGE_MAX_BYTES,
	COACH_IMAGE_MAX_DIMENSION,
	COACH_IMAGE_MAX_PIXELS
} from './coach-images';

export class CoachImageError extends Error {}

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
