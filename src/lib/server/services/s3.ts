import {
	S3Client,
	PutObjectCommand,
	GetObjectCommand,
	ListObjectsV2Command
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { buildPublicAssetUrl, normalizePublicAssetKey } from '$lib/public-asset-url';
import type { Readable } from 'stream';

const DEFAULT_EXPIRES = 900; // 15 min

function createS3Client(): S3Client {
	const region = privateEnv.AWS_REGION;
	const endpoint = privateEnv.AWS_S3_ENDPOINT;
	const forcePathStyle = privateEnv.AWS_S3_FORCE_PATH_STYLE === 'true';

	// Use keys from SvelteKit private env so dev/prod reliably see `.env` (SDK default chain
	// only reads `process.env`, which is not always populated the same way under Vite).
	const accessKeyId = privateEnv.AWS_ACCESS_KEY_ID?.trim();
	const secretAccessKey = privateEnv.AWS_SECRET_ACCESS_KEY?.trim();
	const sessionToken = privateEnv.AWS_SESSION_TOKEN?.trim();

	const cfg: ConstructorParameters<typeof S3Client>[0] = { region };
	if (endpoint) {
		cfg.endpoint = endpoint;
		cfg.forcePathStyle = forcePathStyle;
	}
	if (accessKeyId && secretAccessKey) {
		cfg.credentials = {
			accessKeyId,
			secretAccessKey,
			...(sessionToken ? { sessionToken } : {})
		};
	}
	return new S3Client(cfg);
}

const s3 = createS3Client();
const defaultBucket = privateEnv.AWS_S3_BUCKET;

function createR2Client(): S3Client {
	const region = privateEnv.R2_REGION ?? 'auto';
	const endpoint = privateEnv.R2_ENDPOINT?.trim();
	const forcePathStyle =
		privateEnv.R2_FORCE_PATH_STYLE === undefined
			? true
			: privateEnv.R2_FORCE_PATH_STYLE === 'true';

	const accessKeyId = privateEnv.R2_ACCESS_KEY_ID?.trim();
	const secretAccessKey = privateEnv.R2_SECRET_ACCESS_KEY?.trim();

	const cfg: ConstructorParameters<typeof S3Client>[0] = { region };
	if (endpoint) {
		cfg.endpoint = endpoint;
		cfg.forcePathStyle = forcePathStyle;
	}
	if (accessKeyId && secretAccessKey) {
		cfg.credentials = { accessKeyId, secretAccessKey };
	}
	return new S3Client(cfg);
}

const r2 = createR2Client();
const r2PublicBucket = privateEnv.R2_PUBLIC_BUCKET;

function resolveBucket(bucket?: string): string {
	return bucket ?? defaultBucket ?? '';
}

function resolveR2PublicBucket(): string {
	const bucket = r2PublicBucket?.trim();
	if (!bucket) {
		throw new Error('R2_PUBLIC_BUCKET is not configured');
	}
	return bucket;
}

/** Public CDN URL for an object key in the public R2 bucket. */
export function getPublicAssetUrl(key: string): string | null {
	const base = publicEnv.PUBLIC_R2_ASSETS_URL?.trim();
	if (!base) return null;
	return buildPublicAssetUrl(base, normalizePublicAssetKey(key));
}

/** Upload a file to the public R2 bucket. */
export async function putPublicAsset(opts: {
	key: string;
	body: string | Buffer;
	contentType?: string;
	cacheControl?: string;
}): Promise<{ key: string; publicUrl: string | null }> {
	const key = normalizePublicAssetKey(opts.key);
	const cmd = new PutObjectCommand({
		Bucket: resolveR2PublicBucket(),
		Key: key,
		Body: opts.body,
		ContentType: opts.contentType,
		CacheControl: opts.cacheControl ?? 'public, max-age=31536000, immutable'
	});
	await r2.send(cmd);
	return { key, publicUrl: getPublicAssetUrl(key) };
}

export async function getPresignedUploadUrl(opts: {
	key: string;
	bucket?: string;
	contentType?: string;
	expiresIn?: number;
}): Promise<{ url: string; method: 'PUT'; headers: Record<string, string> }> {
	const cmd = new PutObjectCommand({
		Bucket: resolveBucket(opts.bucket),
		Key: opts.key,
		ContentType: opts.contentType
	});
	const url = await getSignedUrl(s3, cmd, { expiresIn: opts.expiresIn ?? DEFAULT_EXPIRES });
	return {
		url,
		method: 'PUT',
		headers: opts.contentType ? { 'Content-Type': opts.contentType } : {}
	};
}

export async function getPresignedDownloadUrl(opts: {
	key: string;
	bucket?: string;
	expiresIn?: number;
}): Promise<{ url: string; method: 'GET' }> {
	const cmd = new GetObjectCommand({ Bucket: resolveBucket(opts.bucket), Key: opts.key });
	const url = await getSignedUrl(s3, cmd, { expiresIn: opts.expiresIn ?? DEFAULT_EXPIRES });
	return { url, method: 'GET' };
}

export async function putObject(opts: {
	key: string;
	bucket?: string;
	body: string | Buffer;
	contentType?: string;
}): Promise<void> {
	const cmd = new PutObjectCommand({
		Bucket: resolveBucket(opts.bucket),
		Key: opts.key,
		Body: opts.body,
		ContentType: opts.contentType
	});
	await s3.send(cmd);
}

export async function getObjectStream(opts: { key: string; bucket?: string }): Promise<Readable> {
	const cmd = new GetObjectCommand({ Bucket: resolveBucket(opts.bucket), Key: opts.key });
	const resp = await s3.send(cmd);
	return resp.Body as Readable;
}

/** Lists every object key under the prefix, following S3 continuation tokens. */
export async function listAllObjectKeys(opts: {
	prefix?: string;
	bucket?: string;
	maxKeysPerPage?: number;
}): Promise<string[]> {
	const keys: string[] = [];
	let continuationToken: string | undefined;

	do {
		const cmd = new ListObjectsV2Command({
			Bucket: resolveBucket(opts.bucket),
			Prefix: opts.prefix ?? '',
			MaxKeys: opts.maxKeysPerPage ?? 1000,
			ContinuationToken: continuationToken
		});
		const resp = await s3.send(cmd);
		for (const obj of resp.Contents ?? []) {
			if (obj.Key) keys.push(obj.Key);
		}
		continuationToken = resp.IsTruncated ? resp.NextContinuationToken : undefined;
	} while (continuationToken);

	return keys;
}
