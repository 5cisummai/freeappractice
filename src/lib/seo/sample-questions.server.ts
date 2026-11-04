import sampleQuestionsSnapshot from './data/unit-sample-questions.json';
import {
	getSeoSampleQuestionsForSlug,
	type SeoSamplePage,
	type SeoSampleQuestion,
	type SeoSampleQuestionsSnapshot
} from './sample-questions.js';

const snapshot = sampleQuestionsSnapshot as SeoSampleQuestionsSnapshot;

export function getSeoSampleQuestionsForPage(page: SeoSamplePage): SeoSampleQuestion[] {
	if (page.type !== 'unit') return [];
	return getSeoSampleQuestionsForSlug(snapshot, page.slug);
}
