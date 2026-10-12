import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { put, get, del } from '@vercel/blob';
import {
	S3Client,
	PutObjectCommand,
	GetObjectCommand,
	DeleteObjectCommand
} from '@aws-sdk/client-s3';

export type CoachImageStore = 'blob' | 's3';

export function coachImageStore(): CoachImageStore {
	return dev && env.COACH_IMAGE_S3_ENDPOINT ? 's3' : 'blob';
}

function s3() {
	// An endpoint override is local development configuration, never a production fallback.
	if (!dev) throw new Error('Local Coach image storage is unavailable in production');
	return new S3Client({
		endpoint: env.COACH_IMAGE_S3_ENDPOINT,
		region: 'us-east-1',
		forcePathStyle: true,
		credentials: {
			accessKeyId: env.COACH_IMAGE_S3_ACCESS_KEY ?? '',
			secretAccessKey: env.COACH_IMAGE_S3_SECRET_KEY ?? ''
		}
	});
}

export async function putCoachImage(store: CoachImageStore, pathname: string, bytes: Buffer) {
	if (store === 's3') {
		await s3().send(
			new PutObjectCommand({
				Bucket: env.COACH_IMAGE_S3_BUCKET,
				Key: pathname,
				Body: bytes,
				ContentType: 'image/webp'
			})
		);
	} else {
		await put(pathname, bytes, {
			access: 'private',
			addRandomSuffix: false,
			contentType: 'image/webp'
		});
	}
}

export async function readCoachImage(store: CoachImageStore, pathname: string): Promise<Buffer> {
	if (store === 's3') {
		const result = await s3().send(
			new GetObjectCommand({ Bucket: env.COACH_IMAGE_S3_BUCKET, Key: pathname })
		);
		if (!result.Body) throw new Error('Image unavailable');
		return Buffer.from(await result.Body.transformToByteArray());
	}
	const result = await get(pathname, { access: 'private', useCache: false });
	if (!result || !result.stream) throw new Error('Image unavailable');
	return Buffer.from(await new Response(result.stream).arrayBuffer());
}

export async function deleteCoachImage(store: CoachImageStore, pathname: string) {
	if (store === 's3') {
		await s3().send(new DeleteObjectCommand({ Bucket: env.COACH_IMAGE_S3_BUCKET, Key: pathname }));
	} else {
		await del(pathname);
	}
}
