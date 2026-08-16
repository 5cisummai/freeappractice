/**
 * scripts/sync-question-ids-from-s3.ts
 *
 * Backfill the PostgreSQL question registry from every object under `questions/` in S3.
 *
 *   bun run sync:question-ids
 *   bun run sync:question-ids --dry-run
 *   bun run sync:question-ids --hydrate  # required before class/unit-filtered backfill
 */

import 'dotenv/config';
import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { createHash } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { getNeonDatabase } from '../src/lib/server/neon/db';
import { questionRegistry } from '../src/lib/server/neon/schema';

const DATABASE_URL = process.env.DATABASE_URL;
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET;
const isDryRun = process.argv.includes('--dry-run');
const hydrateMetadata = process.argv.includes('--hydrate');
const BATCH_SIZE = 1000;
const QUESTION_KEY_RE = /^questions\/([^/]+)\.json$/;

if (!DATABASE_URL) {
	console.error('Error: DATABASE_URL is not set in your environment / .env file.');
	process.exit(1);
}

if (!AWS_S3_BUCKET?.trim()) {
	console.error('Error: AWS_S3_BUCKET is not set in your environment / .env file.');
	process.exit(1);
}

function createS3Client(): S3Client {
	const region = process.env.AWS_REGION;
	const endpoint = process.env.AWS_S3_ENDPOINT;
	const forcePathStyle = process.env.AWS_S3_FORCE_PATH_STYLE === 'true';
	const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
	const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
	const sessionToken = process.env.AWS_SESSION_TOKEN?.trim();

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

async function listQuestionIdsFromS3(s3: S3Client, bucket: string): Promise<string[]> {
	const ids: string[] = [];
	let continuationToken: string | undefined;

	do {
		const resp = await s3.send(
			new ListObjectsV2Command({
				Bucket: bucket,
				Prefix: 'questions/',
				ContinuationToken: continuationToken
			})
		);

		for (const obj of resp.Contents ?? []) {
			if (!obj.Key) continue;
			const match = obj.Key.match(QUESTION_KEY_RE);
			if (match) ids.push(match[1]);
		}

		continuationToken = resp.IsTruncated ? resp.NextContinuationToken : undefined;
	} while (continuationToken);

	return ids;
}

async function main() {
	const s3 = createS3Client();
	const bucket = AWS_S3_BUCKET!.trim();

	console.log('Listing question objects from S3…');
	const s3Ids = [...new Set(await listQuestionIdsFromS3(s3, bucket))].sort();
	console.log(`Found ${s3Ids.length} unique question id(s) in S3.`);

	const db = getNeonDatabase();

	const [existingCountRow] = await db
		.select({ count: sql<number>`count(*)` })
		.from(questionRegistry);
	const existingCount = Number(existingCountRow?.count ?? 0);
	console.log(`Registry currently has ${existingCount} document(s).`);

	if (isDryRun) {
		const existingIds = new Set(
			(await db.select({ questionId: questionRegistry.questionId }).from(questionRegistry)).map(
				(doc) => doc.questionId
			)
		);
		const missing = s3Ids.filter((id) => !existingIds.has(id));
		console.log(`Dry-run: would insert ${missing.length} new id(s).`);
		return;
	}

	let inserted = 0;
	for (let i = 0; i < s3Ids.length; i += BATCH_SIZE) {
		const batch = s3Ids.slice(i, i + BATCH_SIZE);
		const result = await db
			.insert(questionRegistry)
			.values(batch.map((questionId) => ({ questionId, kind: 'mcq' })))
			.onConflictDoNothing({ target: questionRegistry.questionId })
			.returning({ questionId: questionRegistry.questionId });
		inserted += result.length;
	}

	const [finalCountRow] = await db.select({ count: sql<number>`count(*)` }).from(questionRegistry);
	const finalCount = Number(finalCountRow?.count ?? 0);
	console.log(`✓ Upserted ${inserted} new id(s). Registry now has ${finalCount} document(s).`);

	if (hydrateMetadata) {
		console.log('Hydrating AP class, unit, source date, and content hash from S3…');
		let hydrated = 0;
		for (let i = 0; i < s3Ids.length; i += 10) {
			const rows = await Promise.all(
				s3Ids.slice(i, i + 10).map(async (questionId) => {
					try {
						const response = await s3.send(
							new GetObjectCommand({ Bucket: bucket, Key: `questions/${questionId}.json` })
						);
						if (!response.Body) return null;
						const body = await response.Body.transformToString();
						const question = JSON.parse(body) as {
							apClass?: string;
							unit?: string;
							createdAt?: string;
						};
						return {
							questionId,
							apClass: question.apClass,
							unit: question.unit,
							questionCreatedAt: question.createdAt ? new Date(question.createdAt) : undefined,
							contentHash: createHash('sha256').update(body).digest('hex'),
							contentLength: body.length,
							metadataSyncedAt: new Date()
						};
					} catch (error) {
						console.warn(`Could not hydrate ${questionId}:`, error);
						return null;
					}
				})
			);
			const valid = rows.filter((row): row is NonNullable<typeof row> => row !== null);
			if (valid.length) {
				await Promise.all(
					valid.map((row) =>
						db
							.update(questionRegistry)
							.set(row)
							.where(eq(questionRegistry.questionId, row.questionId))
					)
				);
				hydrated += valid.length;
			}
			console.log(`Hydrated ${Math.min(i + 10, s3Ids.length)}/${s3Ids.length}`);
		}
		console.log(`✓ Hydrated ${hydrated} question registry record(s).`);
	}
}

main().catch((err) => {
	console.error('Script failed:', err);
	process.exitCode = 1;
});
