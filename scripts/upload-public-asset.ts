/**
 * Upload a local file to the public R2 assets bucket.
 *
 *   pnpm assets:upload <local-file> <object-key>
 *
 * Example:
 *   pnpm assets:upload ./mission.jpg pages/about/mission-planning.jpg
 *
 * Requires:
 *   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_PUBLIC_BUCKET
 * Optional:
 *   PUBLIC_R2_ASSETS_URL (prints the public URL after upload)
 */

import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import {
	buildPublicAssetUrl,
	contentTypeForAssetPath,
	normalizePublicAssetKey
} from '../src/lib/public-asset-url';

const [, , localPath, rawKey] = process.argv;

if (!localPath || !rawKey) {
	console.error('Usage: pnpm assets:upload <local-file> <object-key>');
	process.exit(1);
}

const bucket = process.env.R2_PUBLIC_BUCKET?.trim();
if (!bucket) {
	console.error('Error: R2_PUBLIC_BUCKET is not set in your environment / .env file.');
	process.exit(1);
}

const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
if (!accessKeyId || !secretAccessKey) {
	console.error('Error: R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY are required.');
	process.exit(1);
}

const endpoint = process.env.R2_ENDPOINT?.trim();
if (!endpoint) {
	console.error('Error: R2_ENDPOINT is not set in your environment / .env file.');
	process.exit(1);
}

const key = normalizePublicAssetKey(rawKey);
const contentType = contentTypeForAssetPath(localPath);

const r2 = new S3Client({
	region: process.env.R2_REGION ?? 'auto',
	endpoint,
	forcePathStyle:
		process.env.R2_FORCE_PATH_STYLE === undefined
			? true
			: process.env.R2_FORCE_PATH_STYLE === 'true',
	credentials: { accessKeyId, secretAccessKey }
});

const body = await readFile(localPath);

await r2.send(
	new PutObjectCommand({
		Bucket: bucket,
		Key: key,
		Body: body,
		ContentType: contentType,
		CacheControl: 'public, max-age=31536000, immutable'
	})
);

const publicBase = process.env.PUBLIC_R2_ASSETS_URL?.trim();
const publicUrl = publicBase ? buildPublicAssetUrl(publicBase, key) : null;

console.log(`Uploaded ${localPath} -> r2://${bucket}/${key}`);
if (publicUrl) {
	console.log(`Public URL: ${publicUrl}`);
} else {
	console.log('Set PUBLIC_R2_ASSETS_URL in .env to print the public CDN URL.');
}
