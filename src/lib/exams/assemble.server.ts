import { and, desc, eq } from 'drizzle-orm';
import { AP_DATA, getUnitsForCourse, isMcqPracticeCourse } from '#lib/catalog/courses.js';
import { loadExamBlueprint, type ExamBlueprintSection } from '#lib/exams/blueprints.js';
import type { ExamSection } from '#lib/exams/session.js';
import { frqBank } from '#lib/question-bank/frq/bank.server.js';
import {
	frqPracticeFor,
	resolveFrqPoolRequest,
	UnknownFrqTaskError
} from '#lib/question-bank/frq/practice.js';
import {
	assembleMcqQuiz,
	QuizPoolWarmingError,
	requestQuizRefill
} from '#lib/question-bank/mcq/quiz-assembler.server.js';
import { isStimulusQuestionsEnabled } from '#lib/flags.js';
import { QUESTION_POOL_CONFIG } from '#lib/question-bank/pool-constants.js';
import { getNeonDatabase } from '#lib/server/neon/db.js';
import { examAttempts, frqAttempts, mcqAttempts } from '#lib/server/neon/schema.js';
import { logger } from '#lib/server/logger.js';

/**
 * Inventory design target: aggregate active questions across a course's buckets
 * should support this many concurrent full-length exams before refill must catch up.
 * Per-bucket FRQ target remains QUESTION_POOL_FRQ_TARGET; MCQ preferred targets stay course-specific.
 */
export const EXAM_CONCURRENT_CAPACITY = 2;

const MAX_EXCLUDE_IDS = 100;
const RECENT_PRACTICE_EXCLUDE = 40;
const RECENT_EXAM_ATTEMPTS = 5;

export type AssembleExamResult =
	| { ok: true; course: string; sections: ExamSection[] }
	| {
			ok: false;
			code: 'unsupported' | 'warming' | 'failed';
			reason: string;
			retryAfterSeconds?: number;
	  };

function courseRow(courseName: string) {
	return AP_DATA.courses.find((course) => course.name === courseName);
}

function frqPracticeEnabled(courseName: string): boolean {
	return courseRow(courseName)?.app.practice.frq.enabled === true;
}

async function recentPracticeQuestionIds(
	userId: string,
	course: string,
	mode: 'mcq' | 'frq'
): Promise<string[]> {
	const db = getNeonDatabase();
	if (mode === 'frq') {
		const rows = await db
			.select({ questionId: frqAttempts.questionId })
			.from(frqAttempts)
			.where(and(eq(frqAttempts.userId, userId), eq(frqAttempts.course, course)))
			.orderBy(desc(frqAttempts.createdAt), desc(frqAttempts.id))
			.limit(RECENT_PRACTICE_EXCLUDE);
		return rows.map((row) => row.questionId);
	}
	const rows = await db
		.select({ questionId: mcqAttempts.questionId })
		.from(mcqAttempts)
		.where(and(eq(mcqAttempts.userId, userId), eq(mcqAttempts.course, course)))
		.orderBy(desc(mcqAttempts.createdAt), desc(mcqAttempts.id))
		.limit(RECENT_PRACTICE_EXCLUDE);
	return rows.map((row) => row.questionId);
}

async function recentExamQuestionIds(userId: string, course: string): Promise<string[]> {
	const rows = await getNeonDatabase()
		.select({ sections: examAttempts.sections })
		.from(examAttempts)
		.where(and(eq(examAttempts.userId, userId), eq(examAttempts.course, course)))
		.orderBy(desc(examAttempts.startedAt), desc(examAttempts.id))
		.limit(RECENT_EXAM_ATTEMPTS);
	const ids: string[] = [];
	for (const row of rows) {
		for (const section of row.sections) {
			for (const item of section.items) ids.push(item.questionId);
		}
	}
	return ids;
}

function cappedUnique(ids: string[]): string[] {
	return [...new Set(ids.map((id) => id.trim()).filter(Boolean))].slice(0, MAX_EXCLUDE_IDS);
}

function itemId(sectionId: string, index: number): string {
	return `${sectionId}-${String(index + 1).padStart(3, '0')}`;
}

function toExamSection(blueprint: ExamBlueprintSection, questionIds: string[]): ExamSection {
	return {
		id: blueprint.id,
		kind: blueprint.kind,
		title: blueprint.label,
		timeLimitMs: blueprint.timeLimitMs,
		items: questionIds.map((questionId, index) => ({
			id: itemId(blueprint.id, index),
			questionId
		}))
	};
}

async function assembleMcqSection(
	course: string,
	section: ExamBlueprintSection,
	excludeQuestionIds: string[]
): Promise<{ questionIds: string[] } | { warming: true; reason: string }> {
	try {
		const globalFlagEnabled = await isStimulusQuestionsEnabled();
		const assembled = await assembleMcqQuiz(
			{
				course,
				count: section.questionCount,
				maxCount: section.questionCount,
				excludeQuestionIds
			},
			{ globalFlagEnabled }
		);
		const questionIds = assembled.questions
			.map((question) => question.questionId)
			.filter((id): id is string => typeof id === 'string' && id.length > 0);
		if (questionIds.length !== section.questionCount) {
			await requestQuizRefill(course, '');
			return {
				warming: true,
				reason: `Not enough unique MCQ questions to fill ${section.questionCount} items.`
			};
		}
		if (new Set(questionIds).size !== questionIds.length) {
			return {
				warming: true,
				reason: 'Exam MCQ assembly produced duplicate question IDs.'
			};
		}
		return { questionIds };
	} catch (error) {
		await requestQuizRefill(course, '');
		if (error instanceof QuizPoolWarmingError) {
			return { warming: true, reason: error.message };
		}
		throw error;
	}
}

async function assembleFrqSection(
	course: string,
	section: ExamBlueprintSection,
	excludeQuestionIds: string[]
): Promise<{ questionIds: string[] } | { warming: true; reason: string }> {
	const practice = frqPracticeFor(course);
	if (!practice) {
		return { warming: true, reason: `FRQ practice is not available for ${course}.` };
	}

	const units = getUnitsForCourse(course);
	const drawn: string[] = [];
	const exclude = [...excludeQuestionIds];

	// Prefer this section's official questionTypes (task quotas are per-section, not whole-exam).
	const sectionFormats = [...section.questionTypes];
	while (sectionFormats.length < section.questionCount && practice.tasks.length) {
		const fallback = practice.tasks[sectionFormats.length % practice.tasks.length];
		if (!fallback) break;
		sectionFormats.push(fallback.formatId);
	}

	const drawTargets: Array<{ unitHint: string; formatId?: string }> = [];
	if (practice.control === 'task') {
		for (let index = 0; index < section.questionCount; index += 1) {
			drawTargets.push({ unitHint: '', formatId: sectionFormats[index] });
		}
	} else {
		for (let index = 0; index < section.questionCount; index += 1) {
			const unit = units[index % Math.max(1, units.length)] ?? '';
			drawTargets.push({ unitHint: unit, formatId: sectionFormats[index] });
		}
	}

	for (const target of drawTargets) {
		let poolUnit: string;
		try {
			poolUnit = resolveFrqPoolRequest(course, target.unitHint, target.formatId).poolUnit;
		} catch (error) {
			if (error instanceof UnknownFrqTaskError) {
				return { warming: true, reason: error.message };
			}
			throw error;
		}

		const result = await frqBank.get(course, poolUnit, {
			excludeQuestionIds: exclude,
			allowRefill: true
		});
		if (result.status === 'warming') {
			return {
				warming: true,
				reason: `FRQ pool is warming up for ${course} (${poolUnit}).`
			};
		}
		if (result.status === 'failed') {
			throw result.error instanceof Error ? result.error : new Error('FRQ pool selection failed');
		}
		if (result.exclusionsReset || drawn.includes(result.result.questionId)) {
			return {
				warming: true,
				reason: `Not enough unique FRQ questions to fill ${section.questionCount} items for ${course}.`
			};
		}
		drawn.push(result.result.questionId);
		exclude.push(result.result.questionId);
	}

	return { questionIds: drawn };
}

/** Assemble blueprint-sized MCQ/FRQ sections with no duplicate question IDs. */
export async function assembleExamSections(input: {
	userId: string;
	courseName: string;
}): Promise<AssembleExamResult> {
	const courseName = input.courseName.trim();
	const blueprintResult = loadExamBlueprint(courseName);
	if (!blueprintResult.ok) {
		return { ok: false, code: 'unsupported', reason: blueprintResult.reason };
	}
	if (!isMcqPracticeCourse(courseName)) {
		return {
			ok: false,
			code: 'unsupported',
			reason: `MCQ practice is not enabled for ${courseName}.`
		};
	}

	const blueprint = blueprintResult.blueprint;
	const needsFrq = blueprint.sections.some((section) => section.kind === 'frq');
	if (needsFrq && !frqPracticeEnabled(courseName)) {
		return {
			ok: false,
			code: 'unsupported',
			reason: `FRQ practice is not enabled for ${courseName}.`
		};
	}

	const [recentMcq, recentFrq, recentExam] = await Promise.all([
		recentPracticeQuestionIds(input.userId, courseName, 'mcq'),
		recentPracticeQuestionIds(input.userId, courseName, 'frq'),
		recentExamQuestionIds(input.userId, courseName)
	]);
	const excludeBase = cappedUnique([...recentExam, ...recentMcq, ...recentFrq]);
	const used = new Set<string>();
	const sections: ExamSection[] = [];

	try {
		for (const blueprintSection of blueprint.sections) {
			const exclude = cappedUnique([...excludeBase, ...used]);
			if (blueprintSection.kind === 'mcq') {
				const assembled = await assembleMcqSection(courseName, blueprintSection, exclude);
				if ('warming' in assembled) {
					return {
						ok: false,
						code: 'warming',
						reason: assembled.reason,
						retryAfterSeconds: QUESTION_POOL_CONFIG.warmingRetryAfterSeconds
					};
				}
				for (const id of assembled.questionIds) {
					if (used.has(id)) {
						return {
							ok: false,
							code: 'warming',
							reason: 'Exam assembly produced duplicate MCQ question IDs across sections.',
							retryAfterSeconds: QUESTION_POOL_CONFIG.warmingRetryAfterSeconds
						};
					}
					used.add(id);
				}
				sections.push(toExamSection(blueprintSection, assembled.questionIds));
				continue;
			}

			const assembled = await assembleFrqSection(courseName, blueprintSection, exclude);
			if ('warming' in assembled) {
				return {
					ok: false,
					code: 'warming',
					reason: assembled.reason,
					retryAfterSeconds: QUESTION_POOL_CONFIG.warmingRetryAfterSeconds
				};
			}
			for (const id of assembled.questionIds) {
				if (used.has(id)) {
					return {
						ok: false,
						code: 'warming',
						reason: 'Exam assembly produced duplicate FRQ question IDs across sections.',
						retryAfterSeconds: QUESTION_POOL_CONFIG.warmingRetryAfterSeconds
					};
				}
				used.add(id);
			}
			sections.push(toExamSection(blueprintSection, assembled.questionIds));
		}
	} catch (error) {
		logger.error('Exam assembly failed', { course: courseName, error });
		return {
			ok: false,
			code: 'failed',
			reason: 'Failed to assemble a full-length exam.'
		};
	}

	return { ok: true, course: courseName, sections };
}
