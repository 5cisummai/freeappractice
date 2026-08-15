import { and, eq, inArray, sql } from 'drizzle-orm';
import { getNeonDatabase } from '$lib/server/neon/db';
import { questionQuality, qualityReviewJobItems } from '$lib/server/neon/schema';

const COSTED_ITEM_STATUSES = ['final', 'awaiting_human'] as const;

/** Sum persisted AI-assessment costs for review items that reached a final state. */
export async function getCompletedReviewCost(jobId: string): Promise<number> {
	const [row] = await getNeonDatabase()
		.select({
			total: sql<string>`
				coalesce(
					sum(
						case
							when jsonb_typeof(${questionQuality.aiAssessment}->'usage'->'estimatedCostUsd') = 'number'
							then (${questionQuality.aiAssessment}->'usage'->>'estimatedCostUsd')::numeric
							else 0
						end
					),
					0
				)::text
			`
		})
		.from(qualityReviewJobItems)
		.leftJoin(questionQuality, eq(qualityReviewJobItems.questionId, questionQuality.questionId))
		.where(
			and(
				eq(qualityReviewJobItems.jobId, jobId),
				inArray(qualityReviewJobItems.status, COSTED_ITEM_STATUSES)
			)
		);

	return Number(row?.total ?? 0);
}
