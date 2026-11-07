import { and, eq, inArray } from 'drizzle-orm';
import { mcqServableQualityPredicate } from '#lib/question-bank/quality/serving-filter.server.js';
import { getNeonDatabase } from '#lib/server/neon/db.js';
import { mcqQuestions } from '#lib/server/neon/schema.js';
import sampleQuestionsSnapshot from './data/unit-sample-questions.json';
import {
	getSeoSampleQuestionsForSlug,
	parseSeoSampleQuestionCandidate,
	selectSeoSampleQuestions,
	type SeoSamplePage,
	type SeoSampleQuestion
} from './sample-questions.js';

export async function getSeoSampleQuestionsForPage(
	page: SeoSamplePage
): Promise<SeoSampleQuestion[]> {
	if (page.type !== 'unit') return [];
	const questionIds = getSeoSampleQuestionsForSlug(sampleQuestionsSnapshot, page.slug);
	if (questionIds.length === 0) return [];

	try {
		const rows = await getNeonDatabase()
			.select({ questionId: mcqQuestions.questionId, data: mcqQuestions.data })
			.from(mcqQuestions)
			.where(
				and(
					inArray(mcqQuestions.questionId, questionIds),
					eq(mcqQuestions.active, true),
					mcqServableQualityPredicate()
				)
			);

		return selectSeoSampleQuestions(
			rows.flatMap(({ questionId, data }) => {
				const candidate = parseSeoSampleQuestionCandidate(questionId, data);
				return candidate?.course === page.course && candidate.unit === page.unit ? [candidate] : [];
			})
		);
	} catch (error) {
		console.error('Unable to load public practice samples', { slug: page.slug, error });
		return [];
	}
}
