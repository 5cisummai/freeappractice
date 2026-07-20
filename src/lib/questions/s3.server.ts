import {
	S3Client,
	PutObjectCommand,
	GetObjectCommand,
	ListObjectsV2Command
} from '@aws-sdk/client-s3';
import { env as privateEnv } from '$env/dynamic/private';

const ALLOWED_KEY_PREFIXES = ['questions/', 'frqs/'] as const;

class S3ConfigError extends Error {
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

	// Use keys from SvelteKit private env so dev/prod reliably see `.env` (Vite/serverless).
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

/** Fetch an object and parse it as JSON. */
export async function getObjectJson<T = unknown>(opts: {
	key: string;
	bucket?: string;
}): Promise<T> {
	const key = validateS3ObjectKey(opts.key);
	const resp = await s3.send(
		new GetObjectCommand({ Bucket: resolveBucket(opts.bucket), Key: key })
	);
	if (!resp.Body) {
		throw new Error(`Object not found: ${key}`);
	}
	const raw = await resp.Body.transformToString('utf-8');
	return JSON.parse(raw) as T;
}

const QUESTION_KEY_RE = /^questions\/([^/]+)\.json$/;
const FRQ_KEY_RE = /^frqs\/([^/]+)\.json$/;

export interface QuestionObjectSummary {
	questionId: string;
	etag?: string;
	lastModified?: Date;
	size?: number;
}

export interface FrqObjectSummary {
	questionId: string;
	etag?: string;
	lastModified?: Date;
	size?: number;
}

/** List every canonical question id from S3 object keys under `questions/`. */
export async function listQuestionIds(opts?: { bucket?: string }): Promise<string[]> {
	return (await listQuestionObjects(opts)).map((object) => object.questionId);
}

/** List canonical questions with the inexpensive metadata returned by S3 listing. */
export async function listQuestionObjects(opts?: {
	bucket?: string;
}): Promise<QuestionObjectSummary[]> {
	return listPrefixedObjects(opts, 'questions/', QUESTION_KEY_RE);
}

/** List canonical FRQ ids from S3 object keys under `frqs/`. */
export async function listFrqIds(opts?: { bucket?: string }): Promise<string[]> {
	return (await listFrqObjects(opts)).map((object) => object.questionId);
}

/** List canonical FRQs with the inexpensive metadata returned by S3 listing. */
export async function listFrqObjects(opts?: { bucket?: string }): Promise<FrqObjectSummary[]> {
	return listPrefixedObjects(opts, 'frqs/', FRQ_KEY_RE);
}

async function listPrefixedObjects(
	opts: { bucket?: string } | undefined,
	prefix: string,
	keyRe: RegExp
): Promise<QuestionObjectSummary[]> {
	const bucket = resolveBucket(opts?.bucket);
	const objects: QuestionObjectSummary[] = [];
	let continuationToken: string | undefined;

	do {
		const resp = await s3.send(
			new ListObjectsV2Command({
				Bucket: bucket,
				Prefix: prefix,
				ContinuationToken: continuationToken
			})
		);

		for (const obj of resp.Contents ?? []) {
			if (!obj.Key) continue;
			const match = obj.Key.match(keyRe);
			if (match) {
				objects.push({
					questionId: match[1],
					etag: obj.ETag?.replaceAll('"', ''),
					lastModified: obj.LastModified,
					size: obj.Size
				});
			}
		}

		continuationToken = resp.IsTruncated ? resp.NextContinuationToken : undefined;
	} while (continuationToken);

	return objects;
}
