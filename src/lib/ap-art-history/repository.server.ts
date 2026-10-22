import { and, asc, count, eq, gte, lte, sql } from 'drizzle-orm';
import { getNeonDatabase } from '#lib/server/neon/db.js';
import { apArtHistoryWorks } from '#lib/server/neon/schema/ap-art-history.js';
import type {
	ApArtHistoryContentAreaSummary,
	ApArtHistoryWorkListParams
} from '#lib/ap-art-history/types.js';
import { workToDto, type ApArtHistoryWorkDto } from '#lib/ap-art-history/public-payload.server.js';

function buildListWhere(params: ApArtHistoryWorkListParams) {
	const clauses = [];
	if (params.contentArea) {
		clauses.push(eq(apArtHistoryWorks.contentArea, params.contentArea));
	}
	if (params.locationStatus) {
		clauses.push(eq(apArtHistoryWorks.locationStatus, params.locationStatus));
	}
	if (params.numberFrom !== undefined) {
		clauses.push(gte(apArtHistoryWorks.number, params.numberFrom));
	}
	if (params.numberTo !== undefined) {
		clauses.push(lte(apArtHistoryWorks.number, params.numberTo));
	}
	return clauses.length > 0 ? and(...clauses) : undefined;
}

export async function listApArtHistoryWorks(
	params: ApArtHistoryWorkListParams
): Promise<{ items: ApArtHistoryWorkDto[]; total: number; page: number; limit: number }> {
	const db = getNeonDatabase();
	const where = buildListWhere(params);
	const offset = (params.page - 1) * params.limit;

	const [rows, totalRow] = await Promise.all([
		db
			.select()
			.from(apArtHistoryWorks)
			.where(where)
			.orderBy(asc(apArtHistoryWorks.number))
			.limit(params.limit)
			.offset(offset),
		db.select({ total: count() }).from(apArtHistoryWorks).where(where)
	]);

	return {
		items: rows.map(workToDto),
		total: totalRow[0]?.total ?? 0,
		page: params.page,
		limit: params.limit
	};
}

export async function getApArtHistoryWorkByNumber(
	number: number
): Promise<ApArtHistoryWorkDto | null> {
	const db = getNeonDatabase();
	const [row] = await db
		.select()
		.from(apArtHistoryWorks)
		.where(eq(apArtHistoryWorks.number, number))
		.limit(1);
	return row ? workToDto(row) : null;
}

export async function listApArtHistoryContentAreas(): Promise<ApArtHistoryContentAreaSummary[]> {
	const db = getNeonDatabase();
	const rows = await db
		.select({
			contentArea: apArtHistoryWorks.contentArea,
			count: sql<number>`count(*)::int`
		})
		.from(apArtHistoryWorks)
		.groupBy(apArtHistoryWorks.contentArea)
		.orderBy(asc(apArtHistoryWorks.contentArea));
	return rows;
}
