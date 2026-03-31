import {
	S3Client,
	PutObjectCommand,
	GetObjectCommand,
	ListObjectsV2Command
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '$env/dynamic/private';
import type { Readable } from 'stream';

const DEFAULT_EXPIRES = 900; // 15 min

function createS3Client(): S3Client {
	const region = env.AWS_REGION;
	const endpoint = env.AWS_S3_ENDPOINT;
	const forcePathStyle = env.AWS_S3_FORCE_PATH_STYLE === 'true';

	const cfg: ConstructorParameters<typeof S3Client>[0] = { region };
	if (endpoint) {
		cfg.endpoint = endpoint;
		cfg.forcePathStyle = forcePathStyle;
	}
	return new S3Client(cfg);
}

const s3 = createS3Client();
const defaultBucket = env.AWS_S3_BUCKET;

function resolveBucket(bucket?: string): string {
	return bucket ?? defaultBucket ?? '';
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

export async function listObjects(opts: {
	prefix?: string;
	bucket?: string;
	maxKeys?: number;
}): Promise<Array<{ Key?: string }>> {
	const cmd = new ListObjectsV2Command({
		Bucket: resolveBucket(opts.bucket),
		Prefix: opts.prefix ?? '',
		MaxKeys: opts.maxKeys ?? 1000
	});
	const resp = await s3.send(cmd);
	return resp.Contents ?? [];
}
