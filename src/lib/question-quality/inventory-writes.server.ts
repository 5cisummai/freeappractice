import { sql } from 'drizzle-orm';
import { getNeonDatabase } from '$lib/server/neon/db';
import { questionQuality, questionRegistry } from '$lib/server/neon/schema';

const WRITE_CHUNK_SIZE = 1_000;

export interface QuestionInventoryWrite {
	questionId: string;
	questionCreatedAt: Date;
	contentLength: number;
}

export interface QuestionMetadataWrite {
	questionId: string;
	apClass?: string;
	unit?: string;
	questionCreatedAt?: Date;
	contentHash: string;
	contentLength: number;
}

function chunks<T>(values: T[]): T[][] {
	const result: T[][] = [];
	for (let index = 0; index < values.length; index += WRITE_CHUNK_SIZE) {
		result.push(values.slice(index, index + WRITE_CHUNK_SIZE));
	}
	return result;
}

function inventoryPayload(rows: QuestionInventoryWrite[]): string {
	return JSON.stringify(
		rows.map((row) => ({
			questionId: row.questionId,
			questionCreatedAt: row.questionCreatedAt.toISOString(),
			contentLength: row.contentLength
		}))
	);
}

function metadataPayload(rows: QuestionMetadataWrite[]): string {
	return JSON.stringify(
		rows.map((row) => ({
			questionId: row.questionId,
			apClass: row.apClass ?? null,
			unit: row.unit ?? null,
			questionCreatedAt: row.questionCreatedAt?.toISOString() ?? null,
			contentHash: row.contentHash,
			contentLength: row.contentLength
		}))
	);
}

export async function upsertQuestionInventory(rows: QuestionInventoryWrite[]): Promise<void> {
	const db = getNeonDatabase();
	for (const group of chunks(rows)) {
		await db.execute(sql`
			WITH incoming AS (
				SELECT *
				FROM jsonb_to_recordset(${inventoryPayload(group)}::jsonb) AS row(
					"questionId" text,
					"questionCreatedAt" timestamptz,
					"contentLength" integer
				)
			)
			INSERT INTO ${questionRegistry} (
				question_id,
				kind,
				question_created_at,
				content_length,
				created_at,
				updated_at
			)
			SELECT
				"questionId",
				'mcq',
				"questionCreatedAt",
				"contentLength",
				now(),
				now()
			FROM incoming
			ON CONFLICT (question_id) DO UPDATE
			SET question_created_at = EXCLUDED.question_created_at,
				content_length = EXCLUDED.content_length,
				updated_at = now()
		`);
	}
}

export async function syncQuestionMetadata(rows: QuestionMetadataWrite[]): Promise<void> {
	const db = getNeonDatabase();
	for (const group of chunks(rows)) {
		await db.execute(sql`
			WITH incoming AS (
				SELECT *
				FROM jsonb_to_recordset(${metadataPayload(group)}::jsonb) AS row(
					"questionId" text,
					"apClass" text,
					"unit" text,
					"questionCreatedAt" timestamptz,
					"contentHash" text,
					"contentLength" integer
				)
			),
			updated_registry AS (
				UPDATE ${questionRegistry} AS registry
				SET ap_class = coalesce(incoming."apClass", registry.ap_class),
					unit = coalesce(incoming."unit", registry.unit),
					question_created_at = coalesce(incoming."questionCreatedAt", registry.question_created_at),
					content_hash = incoming."contentHash",
					content_length = incoming."contentLength",
					metadata_synced_at = now(),
					updated_at = now()
				FROM incoming
				WHERE registry.question_id = incoming."questionId"
				RETURNING registry.question_id
			)
			UPDATE ${questionQuality} AS quality
			SET source_hash = incoming."contentHash",
				source_created_at = coalesce(incoming."questionCreatedAt", quality.source_created_at),
				updated_at = now()
			FROM incoming
			WHERE quality.question_id = incoming."questionId"
				AND EXISTS (
					SELECT 1 FROM updated_registry
					WHERE updated_registry.question_id = incoming."questionId"
				)
		`);
	}
}

export async function updateQuestionRegistryMetadata(row: QuestionMetadataWrite): Promise<void> {
	await getNeonDatabase().execute(sql`
		UPDATE ${questionRegistry}
		SET ap_class = coalesce(${row.apClass ?? null}, ap_class),
			unit = coalesce(${row.unit ?? null}, unit),
			question_created_at = coalesce(${row.questionCreatedAt ?? null}, question_created_at),
			content_hash = ${row.contentHash},
			content_length = ${row.contentLength},
			metadata_synced_at = now(),
			updated_at = now()
		WHERE question_id = ${row.questionId}
	`);
}
