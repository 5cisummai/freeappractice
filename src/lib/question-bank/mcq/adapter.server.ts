import { getCourses, getUnitsForCourse } from '#lib/catalog/courses.js';
import {
	countActiveMcqQuestions,
	countActiveMcqQuestionsByBucket
} from '#lib/question-bank/mcq/repository.server.js';
import { poolTargetForBucket, type QuestionPoolConfig } from '#lib/question-bank/pool-constants.js';
import type { PoolKindAdapter, PoolKindBucket } from '#lib/question-bank/pool-kinds.server.js';

function listBuckets(): PoolKindBucket[] {
	return getCourses().flatMap((course) =>
		getUnitsForCourse(course.name).map((unit) => ({
			questionType: 'mcq' as const,
			course: course.name,
			unit
		}))
	);
}

/** MCQ catalog, storage counters, and target metadata. */
export const mcqPoolKind: PoolKindAdapter = {
	questionType: 'mcq',
	minimumGenerationHeadroomMs: 10_000,
	listBuckets,
	countActive: countActiveMcqQuestions,
	countActiveByBucket: () => countActiveMcqQuestionsByBucket(true),
	targetFor: (input: {
		course: string;
		generationCountsByCourse?: Record<string, number>;
		config?: QuestionPoolConfig;
	}) => poolTargetForBucket({ questionType: 'mcq', ...input })
};
