import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { env as privateEnv } from '$env/dynamic/private';
import type { Readable } from 'stream';

const ALLOWED_KEY_PREFIXES = ['questions/'] as const;

export class S3ConfigError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'S3ConfigError';
	}
}

export class S3KeyValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'S3KeyValidationError';
	}
}

function assertBucketConfigured(bucket: string): void {
	if (!bucket.trim()) {
		throw new S3ConfigError('S3 bucket is not configured');
	}
}

export function validateS3ObjectKey(key: string): string {
	const trimmed = key.trim();
	if (!trimmed) {
		throw new S3KeyValidationError('key is required');
	}
	if (trimmed.startsWith('/') || trimmed.includes('..') || trimmed.includes('\\')) {
		throw new S3KeyValidationError('key contains invalid path segments');
	}
	if (!ALLOWED_KEY_PREFIXES.some((prefix) => trimmed.startsWith(prefix))) {
		throw new S3KeyValidationError(
			`key must start with one of: ${ALLOWED_KEY_PREFIXES.join(', ')}`
		);
	}
	return trimmed;
}

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

function resolveBucket(bucket?: string): string {
	const resolved = bucket ?? defaultBucket ?? '';
	assertBucketConfigured(resolved);
	return resolved;
}

export async function putObject(opts: {
	key: string;
	bucket?: string;
	body: string | Buffer;
	contentType?: string;
}): Promise<void> {
	const key = validateS3ObjectKey(opts.key);
	const cmd = new PutObjectCommand({
		Bucket: resolveBucket(opts.bucket),
		Key: key,
		Body: opts.body,
		ContentType: opts.contentType
	});
	await s3.send(cmd);
}

export async function getObjectStream(opts: { key: string; bucket?: string }): Promise<Readable> {
	const key = validateS3ObjectKey(opts.key);
	const cmd = new GetObjectCommand({ Bucket: resolveBucket(opts.bucket), Key: key });
	const resp = await s3.send(cmd);
	if (!resp.Body) {
		throw new Error(`Object not found: ${key}`);
	}
	return resp.Body as Readable;
}
